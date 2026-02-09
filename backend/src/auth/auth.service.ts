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
    // 1. Buscar usuário pelo email
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 2. Verificar se usuário está ativo
    if (!user.isActive) {
      throw new UnauthorizedException('Usuário desativado');
    }

    // 3. Validar senha
    const isPasswordValid = await this.usersService.validatePassword(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 4. Gerar JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as unknown as UserRole,
    };

    const accessToken = this.jwtService.sign(payload);

    // 5. Retornar resposta (sem senha)
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
    // 1. Buscar cliente pelo email
    const { data: client } = await this.supabase.client
      .from('clients')
      .select('*')
      .eq('email', dto.email)
      .single();

    if (!client) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 2. Verificar se cliente está ativo
    if (!client.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    // 3. Verificar se cliente tem senha (não usa apenas OAuth)
    if (!client.password) {
      throw new UnauthorizedException('Use o login com Google');
    }

    // 4. Validar senha
    const isPasswordValid = await bcrypt.compare(dto.password, client.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 5. Gerar JWT com role CLIENT
    const payload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };

    const accessToken = this.jwtService.sign(payload);

    // 6. Retornar resposta
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

  async clientGoogleLogin(dto: GoogleAuthDto): Promise<AuthResponseDto> {
    if (!this.googleClient) {
      throw new UnauthorizedException('Google login não configurado');
    }

    // 1. Verificar o token do Google
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

    // 2. Buscar cliente pelo email
    const { data: existingClient } = await this.supabase.client
      .from('clients')
      .select('*')
      .eq('email', email)
      .single();

    let client;

    if (existingClient) {
      // 3a. Cliente existe - vincular googleId se ainda não estiver vinculado
      if (!existingClient.googleId) {
        const { data: updatedClient, error } = await this.supabase.client
          .from('clients')
          .update({ googleId, updatedAt: new Date().toISOString() })
          .eq('id', existingClient.id)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }
        client = updatedClient;
      } else {
        client = existingClient;
      }

      // Verificar se cliente está ativo
      if (!client.isActive) {
        throw new UnauthorizedException('Conta desativada');
      }
    } else {
      // 3b. Cliente não existe - criar novo
      const { data: newClient, error } = await this.supabase.client
        .from('clients')
        .insert({
          name: name || email.split('@')[0],
          email,
          googleId,
          phone: '', // Campo obrigatório - usuário precisará atualizar depois
          isActive: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      client = newClient;
    }

    // 4. Gerar JWT
    const jwtPayload: JwtPayload = {
      sub: client.id,
      email: client.email,
      role: UserRole.CLIENT,
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    // 5. Retornar resposta
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
