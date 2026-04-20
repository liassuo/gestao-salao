jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../common/enums/user-role.enum';

const mockMailService = {
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  sendPasswordSetupInvite: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
};

const mockUsersService = {
  findByEmailWithPassword: jest.fn(),
  validatePassword: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(null),
};

const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn();
  return chain;
};

const mockSupabaseService = {
  from: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── login ──────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = { email: 'admin@example.com', password: 'secret123' };
    const mockUser = {
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      password: 'hashed-password',
      role: UserRole.ADMIN,
      isActive: true,
    };

    it('should return accessToken and user on successful login', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(mockUsersService.findByEmailWithPassword).toHaveBeenCalledWith(loginDto.email);
      expect(mockUsersService.validatePassword).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Credenciais inválidas'),
      );
      expect(mockUsersService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Usuário desativado'),
      );
      expect(mockUsersService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Credenciais inválidas'),
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  // ─── validateToken ──────────────────────────────────────────────────

  describe('validateToken', () => {
    it('should return JwtPayload when token is valid', async () => {
      const expectedPayload = {
        sub: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };
      mockJwtService.verify.mockReturnValue(expectedPayload);

      const result = await service.validateToken('valid-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual(expectedPayload);
    });

    it('should return null when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const result = await service.validateToken('invalid-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('invalid-token');
      expect(result).toBeNull();
    });
  });

  // ─── clientLogin ────────────────────────────────────────────────────

  describe('clientLogin', () => {
    const clientLoginDto = { email: 'client@example.com', password: 'client-pass' };
    const mockClient = {
      id: 'client-1',
      email: 'client@example.com',
      name: 'Client User',
      password: 'hashed-client-password',
      isActive: true,
    };

    it('should return accessToken and user on successful client login', async () => {
      const chain = mockChain();
      chain.single.mockResolvedValue({ data: mockClient });
      mockSupabaseService.from.mockReturnValue(chain);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.clientLogin(clientLoginDto);

      expect(mockSupabaseService.from).toHaveBeenCalledWith('clients');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('email', clientLoginDto.email);
      expect(chain.single).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith(clientLoginDto.password, mockClient.password);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockClient.id,
        email: mockClient.email,
        role: UserRole.CLIENT,
      });
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: mockClient.id,
          email: mockClient.email,
          name: mockClient.name,
          role: UserRole.CLIENT,
        },
      });
    });

    it('should throw UnauthorizedException when client is not found', async () => {
      const chain = mockChain();
      chain.single.mockResolvedValue({ data: null });
      mockSupabaseService.from.mockReturnValue(chain);

      await expect(service.clientLogin(clientLoginDto)).rejects.toThrow(
        new UnauthorizedException('Credenciais inválidas'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when client is inactive', async () => {
      const chain = mockChain();
      chain.single.mockResolvedValue({ data: { ...mockClient, isActive: false } });
      mockSupabaseService.from.mockReturnValue(chain);

      await expect(service.clientLogin(clientLoginDto)).rejects.toThrow(
        new UnauthorizedException('Conta desativada'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when client has no password (Google-only)', async () => {
      const chain = mockChain();
      chain.single.mockResolvedValue({ data: { ...mockClient, password: null } });
      mockSupabaseService.from.mockReturnValue(chain);

      await expect(service.clientLogin(clientLoginDto)).rejects.toThrow(
        new UnauthorizedException('Use o login com Google'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when client password is wrong', async () => {
      const chain = mockChain();
      chain.single.mockResolvedValue({ data: mockClient });
      mockSupabaseService.from.mockReturnValue(chain);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.clientLogin(clientLoginDto)).rejects.toThrow(
        new UnauthorizedException('Credenciais inválidas'),
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });
});
