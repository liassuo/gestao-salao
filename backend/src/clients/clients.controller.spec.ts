import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';

const mockInAppNotifications = {
  send: jest.fn().mockResolvedValue(undefined),
};

describe('ClientsController', () => {
  let app: INestApplication;

  const mockService = {
    findAll: jest.fn(),
    findClientsWithDebts: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const mockClient = {
    id: validUuid,
    name: 'Ana Silva',
    email: 'ana@email.com',
    phone: '11999999999',
    cpf: '12345678900',
    isActive: true,
    hasDebts: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        { provide: ClientsService, useValue: mockService },
        { provide: InAppNotificationsService, useValue: mockInAppNotifications },
      ],
    }).compile();

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

  describe('GET /clients', () => {
    it('should return 200 and an array of clients', async () => {
      mockService.findAll.mockResolvedValue([mockClient]);

      const response = await request(app.getHttpServer())
        .get('/clients')
        .expect(200);

      expect(response.body).toEqual([mockClient]);
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        hasDebts: undefined,
        isActive: undefined,
      });
    });

    it('should pass search filter from query params', async () => {
      mockService.findAll.mockResolvedValue([mockClient]);

      await request(app.getHttpServer())
        .get('/clients?search=Ana')
        .expect(200);

      expect(mockService.findAll).toHaveBeenCalledWith({
        search: 'Ana',
        hasDebts: undefined,
        isActive: undefined,
      });
    });

    it('should convert hasDebts=true string to boolean true', async () => {
      mockService.findAll.mockResolvedValue([mockClient]);

      await request(app.getHttpServer())
        .get('/clients?hasDebts=true')
        .expect(200);

      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        hasDebts: true,
        isActive: undefined,
      });
    });

    it('should convert hasDebts=false string to boolean false', async () => {
      mockService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/clients?hasDebts=false')
        .expect(200);

      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        hasDebts: false,
        isActive: undefined,
      });
    });

    it('should convert isActive=true string to boolean true', async () => {
      mockService.findAll.mockResolvedValue([mockClient]);

      await request(app.getHttpServer())
        .get('/clients?isActive=true')
        .expect(200);

      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        hasDebts: undefined,
        isActive: true,
      });
    });

    it('should convert isActive=false string to boolean false', async () => {
      mockService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/clients?isActive=false')
        .expect(200);

      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        hasDebts: undefined,
        isActive: false,
      });
    });
  });

  describe('GET /clients/with-debts', () => {
    it('should return 200 and clients with debts', async () => {
      const clientWithDebt = { ...mockClient, hasDebts: true };
      mockService.findClientsWithDebts.mockResolvedValue([clientWithDebt]);

      const response = await request(app.getHttpServer())
        .get('/clients/with-debts')
        .expect(200);

      expect(response.body).toEqual([clientWithDebt]);
      expect(mockService.findClientsWithDebts).toHaveBeenCalled();
    });
  });

  describe('GET /clients/:id', () => {
    it('should return 200 and the client for a valid UUID', async () => {
      mockService.findOne.mockResolvedValue(mockClient);

      const response = await request(app.getHttpServer())
        .get(`/clients/${validUuid}`)
        .expect(200);

      expect(response.body).toEqual(mockClient);
      expect(mockService.findOne).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/clients/invalid-uuid')
        .expect(400);

      expect(mockService.findOne).not.toHaveBeenCalled();
    });

    it('should return 404 when service throws NotFoundException', async () => {
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Cliente não encontrado'),
      );

      const response = await request(app.getHttpServer())
        .get(`/clients/${validUuid}`)
        .expect(404);

      expect(response.body.message).toBe('Cliente não encontrado');
    });
  });

  describe('POST /clients', () => {
    it('should return 201 and the created client', async () => {
      const createDto = { name: 'Ana Silva', phone: '11999999999' };
      mockService.create.mockResolvedValue(mockClient);

      const response = await request(app.getHttpServer())
        .post('/clients')
        .send(createDto)
        .expect(201);

      expect(response.body).toEqual(mockClient);
      expect(mockService.create).toHaveBeenCalled();
    });
  });

  describe('PATCH /clients/:id', () => {
    it('should return 200 and the updated client', async () => {
      const updateDto = { name: 'Ana Santos' };
      const updatedClient = { ...mockClient, name: 'Ana Santos' };
      mockService.update.mockResolvedValue(updatedClient);

      const response = await request(app.getHttpServer())
        .patch(`/clients/${validUuid}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toEqual(updatedClient);
      expect(mockService.update).toHaveBeenCalledWith(
        validUuid,
        expect.any(Object),
      );
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .patch('/clients/invalid-uuid')
        .send({ name: 'Test' })
        .expect(400);

      expect(mockService.update).not.toHaveBeenCalled();
    });

    it('should return 404 when service throws NotFoundException', async () => {
      mockService.update.mockRejectedValue(
        new NotFoundException('Cliente não encontrado'),
      );

      const response = await request(app.getHttpServer())
        .patch(`/clients/${validUuid}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.message).toBe('Cliente não encontrado');
    });
  });

  describe('DELETE /clients/:id', () => {
    it('should return 204 on successful deletion', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/clients/${validUuid}`)
        .expect(204);

      expect(mockService.remove).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .delete('/clients/invalid-uuid')
        .expect(400);

      expect(mockService.remove).not.toHaveBeenCalled();
    });

    it('should return 404 when service throws NotFoundException', async () => {
      mockService.remove.mockRejectedValue(
        new NotFoundException('Cliente não encontrado'),
      );

      const response = await request(app.getHttpServer())
        .delete(`/clients/${validUuid}`)
        .expect(404);

      expect(response.body.message).toBe('Cliente não encontrado');
    });
  });
});
