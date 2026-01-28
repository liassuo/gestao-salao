import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    findByEmailWithPassword: jest.fn(),
    validatePassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockPrismaService = {
    client: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = { email: 'admin@test.com', password: 'password123' };

    it('should return access token and user info on successful login', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@test.com',
        name: 'Admin',
        password: 'hashedPassword',
        role: 'ADMIN',
        isActive: true,
      };

      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: '123',
          email: 'admin@test.com',
          name: 'Admin',
          role: 'ADMIN',
        },
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@test.com',
        password: 'hashedPassword',
        isActive: false,
      };

      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@test.com',
        password: 'hashedPassword',
        isActive: true,
      };

      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    it('should return payload when token is valid', async () => {
      const mockPayload = { sub: '123', email: 'test@test.com', role: 'ADMIN' };
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(mockPayload);
    });

    it('should return null when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('clientLogin', () => {
    const loginDto = { email: 'client@test.com', password: 'password123' };

    it('should return access token and client info on successful login', async () => {
      const mockClient = {
        id: '456',
        email: 'client@test.com',
        name: 'Client',
        password: 'hashedPassword',
        isActive: true,
      };

      mockPrismaService.client.findUnique.mockResolvedValue(mockClient);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('client-jwt-token');

      const result = await service.clientLogin(loginDto);

      expect(result.accessToken).toBe('client-jwt-token');
      expect(result.user.id).toBe('456');
    });

    it('should throw UnauthorizedException when client not found', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.clientLogin(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when client is inactive', async () => {
      const mockClient = {
        id: '456',
        email: 'client@test.com',
        password: 'hashedPassword',
        isActive: false,
      };

      mockPrismaService.client.findUnique.mockResolvedValue(mockClient);

      await expect(service.clientLogin(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when client has no password (OAuth only)', async () => {
      const mockClient = {
        id: '456',
        email: 'client@test.com',
        password: null,
        isActive: true,
        googleId: 'google-id',
      };

      mockPrismaService.client.findUnique.mockResolvedValue(mockClient);

      await expect(service.clientLogin(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const mockClient = {
        id: '456',
        email: 'client@test.com',
        password: 'hashedPassword',
        isActive: true,
      };

      mockPrismaService.client.findUnique.mockResolvedValue(mockClient);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.clientLogin(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
