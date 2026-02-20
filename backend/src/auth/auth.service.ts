import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, AuthResponseDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly supabase: SupabaseService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // 1. Buscar usuário pelo email
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 2. Verificar se usuário está ativo
    if (!user.is_active) {
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
    const { data: client } = await this.supabase
      .from('clients')
      .select('*')
      .eq('email', dto.email)
      .single();

    if (!client) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 2. Verificar se cliente está ativo
    if (!client.is_active) {
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
}
