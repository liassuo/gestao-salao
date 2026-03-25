import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
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
    private readonly mailService: MailService,
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

    // Lazy migration: se o hash ainda usa custo alto (≥10), re-hasheia com custo 8 em background
    // Isso melhora o tempo de login nas próximas vezes em servidores com CPU limitada
    const currentCost = this.getBcryptCost((user as any).password);
    if (currentCost >= 10) {
      bcrypt.hash(dto.password, 6).then((newHash) => {
        this.supabase
          .from('users')
          .update({ password: newHash })
          .eq('id', user.id)
          .then(() => {});
      }).catch(() => {});
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

  private getBcryptCost(hash: string): number {
    if (!hash || !hash.startsWith('$2')) return 0;
    const parts = hash.split('$');
    return parts.length >= 3 ? parseInt(parts[2], 10) : 0;
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

    const hashedPassword = await bcrypt.hash(newPassword, 6);

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

    const hashedPassword = await bcrypt.hash(dto.password, 6);

    const regNow = new Date().toISOString();
    const { data: client, error } = await this.supabase
      .from('clients')
      .insert({
        id: randomUUID(),
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

    const hashedPassword = await bcrypt.hash(newPassword, 6);

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

    // Cliente sem senha: deve usar login social ou configurar senha antes
    if (!client.password) {
      throw new UnauthorizedException('Use o login com Google');
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

    // Lazy migration: re-hasheia com custo 8 em background se necessário
    const currentCost = this.getBcryptCost(client.password);
    if (currentCost >= 10) {
      bcrypt.hash(dto.password, 6).then((newHash) => {
        this.supabase
          .from('clients')
          .update({ password: newHash })
          .eq('id', client.id)
          .then(() => {});
      }).catch(() => {});
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

    const hashedPassword = await bcrypt.hash(newPassword, 6);

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

    const hashedPassword = await bcrypt.hash(newPassword, 6);
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
    const tempPassword = randomUUID();
    const hashedPassword = await bcrypt.hash(tempPassword, 6);

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

  // ── Recuperação de senha — Usuários (admin/profissionais) ─────────────────

  async forgotPassword(email: string): Promise<void> {
    const { data: user } = await this.supabase
      .from('users')
      .select('id, name, email, password, isActive')
      .eq('email', email)
      .single();

    // Retorno silencioso para não expor se o email existe
    if (!user || !user.isActive) return;

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, purpose: 'password-reset', table: 'users', pwdPrefix: (user.password || '').slice(0, 10) },
      { expiresIn: '1h' },
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_ADMIN_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/redefinir-senha?token=${resetToken}`;

    await this.mailService.sendPasswordResetEmail(user.email, user.name, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Link inválido ou expirado');
    }

    if (payload.purpose !== 'password-reset' || payload.table !== 'users') {
      throw new BadRequestException('Link inválido');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('A senha deve ter pelo menos 6 caracteres');
    }

    const { data: user } = await this.supabase
      .from('users')
      .select('id, password')
      .eq('id', payload.sub)
      .single();

    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Verificar se o token já foi usado (senha mudou desde a emissão)
    if ((user.password || '').slice(0, 10) !== payload.pwdPrefix) {
      throw new BadRequestException('Este link já foi utilizado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 6);
    await this.supabase
      .from('users')
      .update({ password: hashedPassword, mustChangePassword: false, updatedAt: new Date().toISOString() })
      .eq('id', user.id);
  }

  // ── Recuperação de senha — Clientes ────────────────────────────────────────

  async clientForgotPassword(email: string): Promise<void> {
    const { data: client } = await this.supabase
      .from('clients')
      .select('id, name, email, password, isActive, googleId')
      .eq('email', email)
      .single();

    // Retorno silencioso para não expor se o email existe
    if (!client || !client.isActive) return;

    // Clientes que só usam Google não têm senha
    if (client.googleId && !client.password) return;

    const resetToken = this.jwtService.sign(
      { sub: client.id, email: client.email, purpose: 'password-reset', table: 'clients', pwdPrefix: (client.password || '').slice(0, 10) },
      { expiresIn: '1h' },
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/recuperar-senha?token=${resetToken}`;
    // Note: client domain uses /recuperar-senha, admin uses /redefinir-senha

    await this.mailService.sendPasswordResetEmail(client.email, client.name, resetUrl);
  }

  async clientResetPassword(token: string, newPassword: string): Promise<void> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Link inválido ou expirado');
    }

    if (payload.purpose !== 'password-reset' || payload.table !== 'clients') {
      throw new BadRequestException('Link inválido');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('A senha deve ter pelo menos 6 caracteres');
    }

    const { data: client } = await this.supabase
      .from('clients')
      .select('id, password')
      .eq('id', payload.sub)
      .single();

    if (!client) throw new NotFoundException('Cliente não encontrado');

    if ((client.password || '').slice(0, 10) !== payload.pwdPrefix) {
      throw new BadRequestException('Este link já foi utilizado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 6);
    await this.supabase
      .from('clients')
      .update({ password: hashedPassword, mustChangePassword: false, updatedAt: new Date().toISOString() })
      .eq('id', client.id);
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
          id: randomUUID(),
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
