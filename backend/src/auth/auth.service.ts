import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário desativado');
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

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  async clientLogin(dto: LoginDto): Promise<AuthResponseDto> {
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

    if (!client.password) {
      throw new UnauthorizedException('Use o login com Google');
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
          .update({ googleId })
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
      const { data: newClient, error } = await this.supabase
        .from('clients')
        .insert({
          name: name || email.split('@')[0],
          email,
          googleId,
          phone: '',
          isActive: true,
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
