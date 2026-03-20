import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, AuthResponseDto, GoogleAuthDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto & { mustChangePassword?: boolean }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário desativado');
    }

    // Profissional no primeiro login: precisa criar senha
    if ((user as any).mustChangePassword) {
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role as unknown as UserRole,
      };
      const tempToken = this.jwtService.sign(payload, { expiresIn: '30m' });

      return {
        accessToken: tempToken,
        mustChangePassword: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as unknown as UserRole,
        },
      };
    }

    const isPasswordValid = await this.usersService.validatePassword(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as unknown as UserRole,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as unknown as UserRole,
      },
    };
  }

  async userSetupPassword(userId: string, newPassword: string): Promise<AuthResponseDto> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (newPassword.length < 6) {
      throw new UnauthorizedException('A senha deve ter pelo menos 6 caracteres');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.supabase
      .from('users')
      .update({
        password: hashedPassword,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', userId);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as unknown as UserRole,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as unknown as UserRole,
      },
    };
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  async clientRegister(dto: { name: string; email: string; password: string; phone: string; birthDate?: string }): Promise<AuthResponseDto> {
    // Verificar se email já existe
    const { data: existing } = await this.supabase
      .from('clients')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existing) {
      throw new UnauthorizedException('Email ja cadastrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const regNow = new Date().toISOString();
    const { data: client, error } = await this.supabase
      .from('clients')
      .insert({
        id: crypto.randomUUID(),
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        birthDate: dto.birthDate || null,
        isActive: true,
        hasDebts: false,
        createdAt: regNow,
        updatedAt: regNow,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const payload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: client.id,
        email: client.email,
        name: client.name,
        role: UserRole.CLIENT,
      },
    };
  }

  async clientInitSetupPassword(email: string, newPassword: string): Promise<AuthResponseDto> {
    const { data: client } = await this.supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .single();

    if (!client) {
      throw new UnauthorizedException('Email não encontrado');
    }

    if (!client.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    if (client.password && !client.mustChangePassword) {
      throw new UnauthorizedException('Conta já possui senha. Faça login normalmente.');
    }

    if (newPassword.length < 6) {
      throw new UnauthorizedException('A senha deve ter pelo menos 6 caracteres');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.supabase
      .from('clients')
      .update({
        password: hashedPassword,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', client.id);

    const payload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: client.id,
        email: client.email,
        name: client.name,
        role: UserRole.CLIENT,
      },
    };
  }

  async checkClientEmail(email: string): Promise<{ status: 'new' | 'login' | 'setup_password' | 'google'; name?: string }> {
    const { data: client } = await this.supabase
      .from('clients')
      .select('id, name, password, googleId, mustChangePassword, isActive')
      .eq('email', email)
      .single();

    if (!client) {
      return { status: 'new' };
    }

    if (!client.isActive) {
      return { status: 'new' }; // Conta desativada, tratar como inexistente
    }

    // Cliente tem googleId e não tem senha → só Google
    if (client.googleId && !client.password) {
      return { status: 'google', name: client.name };
    }

    // Cliente sem senha (pré-cadastrado) ou mustChangePassword
    if (!client.password || client.mustChangePassword) {
      return { status: 'setup_password', name: client.name };
    }

    return { status: 'login', name: client.name };
  }

  async clientLogin(dto: LoginDto): Promise<AuthResponseDto & { mustChangePassword?: boolean }> {
    const { data: client } = await this.supabase
      .from('clients')
      .select('*')
      .eq('email', dto.email)
      .single();

    if (!client) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!client.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    // Cliente pré-cadastrado sem senha: precisa criar senha no primeiro acesso
    if (!client.password) {
      const payload: JwtPayload = {
        sub: client.id,
        email: client.email,
        role: UserRole.CLIENT,
      };
      const tempToken = this.jwtService.sign(payload, { expiresIn: '30m' });

      return {
        accessToken: tempToken,
        mustChangePassword: true,
        user: {
          id: client.id,
          email: client.email,
          name: client.name,
          role: UserRole.CLIENT,
        },
      };
    }

    // Cliente com mustChangePassword ativo (admin forçou troca de senha)
    if (client.mustChangePassword) {
      const isPasswordValid = await bcrypt.compare(dto.password, client.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      const payload: JwtPayload = {
        sub: client.id,
        email: client.email,
        role: UserRole.CLIENT,
      };
      const tempToken = this.jwtService.sign(payload, { expiresIn: '30m' });

      return {
        accessToken: tempToken,
        mustChangePassword: true,
        user: {
          id: client.id,
          email: client.email,
          name: client.name,
          role: UserRole.CLIENT,
        },
      };
    }

    const isPasswordValid = await bcrypt.compare(dto.password, client.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: client.id,
        email: client.email,
        name: client.name,
        role: UserRole.CLIENT,
      },
    };
  }

  async clientSetupPassword(clientId: string, newPassword: string): Promise<AuthResponseDto> {
    const { data: client } = await this.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) {
      throw new UnauthorizedException('Cliente não encontrado');
    }

    if (client.password && !client.mustChangePassword) {
      throw new UnauthorizedException('Senha já foi definida. Use a tela de login.');
    }

    if (newPassword.length < 6) {
      throw new UnauthorizedException('A senha deve ter pelo menos 6 caracteres');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.supabase
      .from('clients')
      .update({
        password: hashedPassword,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', clientId);

    const payload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: client.id,
        email: client.email,
        name: client.name,
        role: UserRole.CLIENT,
      },
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const { data: user } = await this.supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.supabase
      .from('users')
      .update({ password: hashedPassword, updatedAt: new Date().toISOString() })
      .eq('id', userId);
  }

  async resetProfessionalPassword(professionalId: string): Promise<{ message: string }> {
    // Buscar o user vinculado ao profissional
    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('professionalId', professionalId)
      .single();

    if (!user) {
      throw new UnauthorizedException('Conta de usuário não encontrada para este profissional');
    }

    // Resetar senha com valor temporário e forçar troca no próximo login
    const tempPassword = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await this.supabase
      .from('users')
      .update({
        password: hashedPassword,
        mustChangePassword: true,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', user.id);

    return { message: 'Senha resetada. O profissional deverá criar uma nova senha no próximo login.' };
  }

  async clientGoogleLogin(dto: GoogleAuthDto): Promise<AuthResponseDto> {
    if (!this.googleClient) {
      throw new UnauthorizedException('Google login não configurado');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token do Google inválido');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Dados do Google incompletos');
    }

    const { email, name, sub: googleId } = payload;

    const { data: existingClient } = await this.supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .single();

    let client;

    if (existingClient) {
      if (!existingClient.googleId) {
        const { data: updatedClient, error } = await this.supabase
          .from('clients')
          .update({ googleId, mustChangePassword: false })
          .eq('id', existingClient.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        client = updatedClient;
      } else {
        client = existingClient;
      }

      if (!client.isActive) {
        throw new UnauthorizedException('Conta desativada');
      }
    } else {
      const googleNow = new Date().toISOString();
      const { data: newClient, error } = await this.supabase
        .from('clients')
        .insert({
          id: crypto.randomUUID(),
          name: name || email.split('@')[0],
          email,
          googleId,
          phone: '',
          isActive: true,
          hasDebts: false,
          createdAt: googleNow,
          updatedAt: googleNow,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      client = newClient;
    }

    const jwtPayload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    return {
      accessToken,
      user: {
        id: client.id,
        email: client.email,
        name: client.name,
        role: UserRole.CLIENT,
      },
    };
  }
}
