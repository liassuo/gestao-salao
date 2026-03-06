import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as request from 'supertest';
import { MulterModule } from '@nestjs/platform-express';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

describe('PromotionsController', () => {
  let app: INestApplication;

  const mockService = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    findTemplates: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    cloneFromTemplate: jest.fn(),
    uploadBanner: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const invalidUuid = 'not-a-valid-uuid';

  const mockPromotion = {
    id: validUuid,
    name: 'Promo Verao',
    discountPercent: 20,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
    status: 'ACTIVE',
    bannerImageUrl: null,
    bannerTitle: null,
    bannerText: null,
    isTemplate: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    services: [],
    products: [],
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MulterModule.register()],
      controllers: [PromotionsController],
      providers: [{ provide: PromotionsService, useValue: mockService }],
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

  describe('GET /promotions', () => {
    it('should return 200 and an array of promotions', async () => {
      mockService.findAll.mockResolvedValue([mockPromotion]);

      const response = await request(app.getHttpServer()).get('/promotions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockPromotion]);
      expect(mockService.findAll).toHaveBeenCalled();
    });

    it('should pass status filter when ?status=ACTIVE', async () => {
      mockService.findAll.mockResolvedValue([mockPromotion]);

      const response = await request(app.getHttpServer()).get('/promotions?status=ACTIVE');

      expect(response.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });

    it('should convert isTemplate query param to boolean true', async () => {
      mockService.findAll.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/promotions?isTemplate=true');

      expect(response.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isTemplate: true }),
      );
    });

    it('should convert isTemplate=false query param to boolean false', async () => {
      mockService.findAll.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/promotions?isTemplate=false');

      expect(response.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isTemplate: false }),
      );
    });
  });

  describe('GET /promotions/active', () => {
    it('should return 200 and active promotions', async () => {
      mockService.findActive.mockResolvedValue([mockPromotion]);

      const response = await request(app.getHttpServer()).get('/promotions/active');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([mockPromotion]);
      expect(mockService.findActive).toHaveBeenCalled();
    });
  });

  describe('GET /promotions/templates', () => {
    it('should return 200 and template promotions', async () => {
      const template = { ...mockPromotion, isTemplate: true };
      mockService.findTemplates.mockResolvedValue([template]);

      const response = await request(app.getHttpServer()).get('/promotions/templates');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([template]);
      expect(mockService.findTemplates).toHaveBeenCalled();
    });
  });

  describe('GET /promotions/:id', () => {
    it('should return 200 with a promotion for a valid UUID', async () => {
      mockService.findOne.mockResolvedValue(mockPromotion);

      const response = await request(app.getHttpServer()).get(`/promotions/${validUuid}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPromotion);
      expect(mockService.findOne).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer()).get(`/promotions/${invalidUuid}`);

      expect(response.status).toBe(400);
      expect(mockService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('POST /promotions', () => {
    it('should return 201 when creating a promotion', async () => {
      const createDto = {
        name: 'Promo Verao',
        discountPercent: 20,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.000Z',
      };
      mockService.create.mockResolvedValue({ id: validUuid, ...createDto });

      const response = await request(app.getHttpServer())
        .post('/promotions')
        .send(createDto);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: validUuid, ...createDto });
      expect(mockService.create).toHaveBeenCalled();
    });
  });

  describe('POST /promotions/clone/:templateId', () => {
    it('should return 201 when cloning from a template with valid UUID', async () => {
      const overrides = { name: 'Cloned Promo' };
      const clonedPromotion = { ...mockPromotion, name: 'Cloned Promo' };
      mockService.cloneFromTemplate.mockResolvedValue(clonedPromotion);

      const response = await request(app.getHttpServer())
        .post(`/promotions/clone/${validUuid}`)
        .send(overrides);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(clonedPromotion);
      expect(mockService.cloneFromTemplate).toHaveBeenCalledWith(validUuid, expect.objectContaining(overrides));
    });

    it('should return 400 for an invalid templateId UUID', async () => {
      const response = await request(app.getHttpServer())
        .post(`/promotions/clone/${invalidUuid}`)
        .send({});

      expect(response.status).toBe(400);
      expect(mockService.cloneFromTemplate).not.toHaveBeenCalled();
    });
  });

  describe('POST /promotions/upload-banner', () => {
    it('should upload a file and return the result', async () => {
      const uploadResult = { url: 'https://example.com/banner.png' };
      mockService.uploadBanner.mockResolvedValue(uploadResult);

      const response = await request(app.getHttpServer())
        .post('/promotions/upload-banner')
        .attach('file', Buffer.from('fake-image-data'), 'banner.png');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(uploadResult);
      expect(mockService.uploadBanner).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: 'banner.png',
          buffer: expect.any(Buffer),
        }),
      );
    });
  });

  describe('PATCH /promotions/:id', () => {
    it('should return 200 when updating a promotion', async () => {
      const updateDto = { name: 'Promo Atualizada' };
      const updatedPromotion = { ...mockPromotion, ...updateDto };
      mockService.update.mockResolvedValue(updatedPromotion);

      const response = await request(app.getHttpServer())
        .patch(`/promotions/${validUuid}`)
        .send(updateDto);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedPromotion);
      expect(mockService.update).toHaveBeenCalledWith(validUuid, expect.objectContaining(updateDto));
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/promotions/${invalidUuid}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /promotions/:id', () => {
    it('should return 204 when removing a promotion', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer()).delete(`/promotions/${validUuid}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(mockService.remove).toHaveBeenCalledWith(validUuid);
    });

    it('should return 400 for an invalid UUID', async () => {
      const response = await request(app.getHttpServer()).delete(`/promotions/${invalidUuid}`);

      expect(response.status).toBe(400);
      expect(mockService.remove).not.toHaveBeenCalled();
    });
  });

  describe('NotFoundException handling', () => {
    it('should return 404 when findOne throws NotFoundException', async () => {
      mockService.findOne.mockRejectedValue(new NotFoundException('Promocao nao encontrada'));

      const response = await request(app.getHttpServer()).get(`/promotions/${validUuid}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Promocao nao encontrada');
    });

    it('should return 404 when update throws NotFoundException', async () => {
      mockService.update.mockRejectedValue(new NotFoundException('Promocao nao encontrada'));

      const response = await request(app.getHttpServer())
        .patch(`/promotions/${validUuid}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Promocao nao encontrada');
    });

    it('should return 404 when remove throws NotFoundException', async () => {
      mockService.remove.mockRejectedValue(new NotFoundException('Promocao nao encontrada'));

      const response = await request(app.getHttpServer()).delete(`/promotions/${validUuid}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Promocao nao encontrada');
    });

    it('should return 404 when cloneFromTemplate throws NotFoundException', async () => {
      mockService.cloneFromTemplate.mockRejectedValue(new NotFoundException('Promocao nao encontrada'));

      const response = await request(app.getHttpServer())
        .post(`/promotions/clone/${validUuid}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Promocao nao encontrada');
    });
  });

  describe('BadRequestException handling', () => {
    it('should return 400 when create throws BadRequestException', async () => {
      mockService.create.mockRejectedValue(
        new BadRequestException('Data final deve ser posterior a data inicial'),
      );

      const response = await request(app.getHttpServer())
        .post('/promotions')
        .send({
          name: 'Bad Promo',
          discountPercent: 10,
          startDate: '2026-12-31T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Data final deve ser posterior a data inicial');
    });

    it('should return 400 when update throws BadRequestException', async () => {
      mockService.update.mockRejectedValue(
        new BadRequestException('Data final deve ser posterior a data inicial'),
      );

      const response = await request(app.getHttpServer())
        .patch(`/promotions/${validUuid}`)
        .send({
          startDate: '2026-12-31T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Data final deve ser posterior a data inicial');
    });
  });
});
