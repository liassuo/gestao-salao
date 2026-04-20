import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ServicesController', () => {
  let app: INestApplication;
  const mockService = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    calculateTotal: jest.fn(),
    findOne: jest.fn(),
    getStatistics: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const invalidUuid = 'not-a-valid-uuid';

  const mockServiceEntity = {
    id: validUuid,
    name: 'Corte de Cabelo',
    description: 'Corte masculino',
    price: 5000,
    duration: 30,
    isActive: true,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: ServicesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /services', () => {
    it('should return 200 and an array of services', async () => {
      mockService.findAll.mockResolvedValue([mockServiceEntity]);

      const response = await request(app.getHttpServer()).get('/services');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockServiceEntity]);
      expect(mockService.findAll).toHaveBeenCalledWith(true);
    });

    it('should pass activeOnly=false when ?all=true', async () => {
      mockService.findAll.mockResolvedValue([mockServiceEntity]);

      const response = await request(app.getHttpServer()).get('/services?all=true');

      expect(response.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(false);
    });

    it('should pass activeOnly=true when ?all is not "true"', async () => {
      mockService.findAll.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/services?all=false');

      expect(response.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('GET /services/active', () => {
    it('should return 200 and active services', async () => {
      mockService.findActive.mockResolvedValue([mockServiceEntity]);

      const response = await request(app.getHttpServer()).get('/services/active');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockServiceEntity]);
      expect(mockService.findActive).toHaveBeenCalled();
    });
  });

  describe('POST /services/calculate', () => {
    it('should return 200 with total price and duration', async () => {
      const serviceIds = [validUuid, 'b2c3d4e5-f6a7-8901-bcde-f12345678901'];
      const calculatedResult = { totalPrice: 10000, totalDuration: 60 };
      mockService.calculateTotal.mockResolvedValue(calculatedResult);

      const response = await request(app.getHttpServer())
        .post('/services/calculate')
        .send({ serviceIds });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(calculatedResult);
      expect(mockService.calculateTotal).toHaveBeenCalledWith(serviceIds);
    });
  });

  describe('GET /services/:id', () => {
    it('should return 200 with a service for a valid UUID', async () => {
      mockService.findOne.mockResolvedValue(mockServiceEntity);

      const response = await request(app.getHttpServer()).get(`/services/${validUuid}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockServiceEntity);
      expect(mockService.findOne).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer()).get(`/services/${invalidUuid}`);

      expect(response.status).toBe(400);
      expect(mockService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('GET /services/:id/statistics', () => {
    it('should return 200 with service statistics', async () => {
      const stats = {
        id: validUuid,
        name: 'Corte de Cabelo',
        price: 5000,
        attendedCount: 0,
        totalRevenue: 0,
      };
      mockService.getStatistics.mockResolvedValue(stats);

      const response = await request(app.getHttpServer()).get(`/services/${validUuid}/statistics`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(stats);
      expect(mockService.getStatistics).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer()).get(`/services/${invalidUuid}/statistics`);

      expect(response.status).toBe(400);
      expect(mockService.getStatistics).not.toHaveBeenCalled();
    });
  });

  describe('POST /services', () => {
    it('should return 201 when creating a service', async () => {
      const createDto = {
        name: 'Corte de Cabelo',
        description: 'Corte masculino',
        price: 5000,
        duration: 30,
      };
      mockService.create.mockResolvedValue({ id: validUuid, ...createDto, isActive: true });

      const response = await request(app.getHttpServer())
        .post('/services')
        .send(createDto);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: validUuid, ...createDto, isActive: true });
      expect(mockService.create).toHaveBeenCalled();
    });
  });

  describe('PATCH /services/:id', () => {
    it('should return 200 when updating a service', async () => {
      const updateDto = { name: 'Corte Atualizado', price: 6000 };
      const updatedService = { ...mockServiceEntity, ...updateDto };
      mockService.update.mockResolvedValue(updatedService);

      const response = await request(app.getHttpServer())
        .patch(`/services/${validUuid}`)
        .send(updateDto);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedService);
      expect(mockService.update).toHaveBeenCalledWith(validUuid, expect.any(Object));
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/services/${invalidUuid}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /services/:id', () => {
    it('should return 204 when removing a service', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer()).delete(`/services/${validUuid}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(mockService.remove).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer()).delete(`/services/${invalidUuid}`);

      expect(response.status).toBe(400);
      expect(mockService.remove).not.toHaveBeenCalled();
    });
  });

  describe('NotFoundException handling', () => {
    it('should return 404 when findOne throws NotFoundException', async () => {
      mockService.findOne.mockRejectedValue(new NotFoundException('Serviço não encontrado'));

      const response = await request(app.getHttpServer()).get(`/services/${validUuid}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Serviço não encontrado');
    });

    it('should return 404 when update throws NotFoundException', async () => {
      mockService.update.mockRejectedValue(new NotFoundException('Serviço não encontrado'));

      const response = await request(app.getHttpServer())
        .patch(`/services/${validUuid}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Serviço não encontrado');
    });

    it('should return 404 when remove throws NotFoundException', async () => {
      mockService.remove.mockRejectedValue(new NotFoundException('Serviço não encontrado'));

      const response = await request(app.getHttpServer()).delete(`/services/${validUuid}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Serviço não encontrado');
    });

    it('should return 404 when getStatistics throws NotFoundException', async () => {
      mockService.getStatistics.mockRejectedValue(new NotFoundException('Serviço não encontrado'));

      const response = await request(app.getHttpServer()).get(`/services/${validUuid}/statistics`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Serviço não encontrado');
    });
  });
});
