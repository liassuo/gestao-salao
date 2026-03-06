import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let app: INestApplication;
  const mockAuthService = {
    login: jest.fn(),
    clientLogin: jest.fn(),
    clientGoogleLogin: jest.fn(),
  };

  const validLoginDto = {
    email: 'test@example.com',
    password: 'password123',
  };

  const authResponse = {
    accessToken: 'jwt-token-mock',
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CLIENT',
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should return 200 with valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(authResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(validLoginDto)
        .expect(200);

      expect(response.body).toEqual(authResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(validLoginDto);
    });

    it('should return 400 with invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'invalid-email', password: 'password123' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('Email inválido')]),
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should return 400 with short password (< 6 chars)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: '12345' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Senha deve ter no mínimo 6 caracteres'),
        ]),
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should return 400 with missing fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.body.message).toEqual(expect.any(Array));
      expect(response.body.message.length).toBeGreaterThanOrEqual(2);
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should return 401 when service throws UnauthorizedException', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciais inválidas'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(validLoginDto)
        .expect(401);

      expect(response.body.message).toBe('Credenciais inválidas');
      expect(mockAuthService.login).toHaveBeenCalledWith(validLoginDto);
    });
  });

  describe('POST /auth/client/login', () => {
    it('should return 200 with valid credentials', async () => {
      mockAuthService.clientLogin.mockResolvedValue(authResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/client/login')
        .send(validLoginDto)
        .expect(200);

      expect(response.body).toEqual(authResponse);
      expect(mockAuthService.clientLogin).toHaveBeenCalledWith(validLoginDto);
    });

    it('should return 400 with invalid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/client/login')
        .send({ email: 'not-an-email', password: '123' })
        .expect(400);

      expect(response.body.message).toEqual(expect.any(Array));
      expect(response.body.message.length).toBeGreaterThanOrEqual(1);
      expect(mockAuthService.clientLogin).not.toHaveBeenCalled();
    });

    it('should return 401 when service throws UnauthorizedException', async () => {
      mockAuthService.clientLogin.mockRejectedValue(
        new UnauthorizedException('Credenciais inválidas'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/client/login')
        .send(validLoginDto)
        .expect(401);

      expect(response.body.message).toBe('Credenciais inválidas');
      expect(mockAuthService.clientLogin).toHaveBeenCalledWith(validLoginDto);
    });
  });

  describe('POST /auth/client/google', () => {
    const validGoogleDto = { credential: 'valid-google-token' };

    it('should return 200 with valid credential', async () => {
      mockAuthService.clientGoogleLogin.mockResolvedValue(authResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/client/google')
        .send(validGoogleDto)
        .expect(200);

      expect(response.body).toEqual(authResponse);
      expect(mockAuthService.clientGoogleLogin).toHaveBeenCalledWith(
        validGoogleDto,
      );
    });

    it('should return 400 with missing credential', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/client/google')
        .send({})
        .expect(400);

      expect(response.body.message).toEqual(expect.any(Array));
      expect(response.body.message.length).toBeGreaterThanOrEqual(1);
      expect(mockAuthService.clientGoogleLogin).not.toHaveBeenCalled();
    });

    it('should return 401 when service throws UnauthorizedException', async () => {
      mockAuthService.clientGoogleLogin.mockRejectedValue(
        new UnauthorizedException('Token do Google inválido'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/client/google')
        .send(validGoogleDto)
        .expect(401);

      expect(response.body.message).toBe('Token do Google inválido');
      expect(mockAuthService.clientGoogleLogin).toHaveBeenCalledWith(
        validGoogleDto,
      );
    });
  });
});
