import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';

describe('ProfessionalsController (integration)', () => {
  let app: INestApplication;

  const mockService = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    findAvailableForBooking: jest.fn(),
    findByService: jest.fn(),
    findOne: jest.fn(),
    getAppointmentsByDate: jest.fn(),
    create: jest.fn(),
    uploadAvatar: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const validUUID = '11111111-1111-1111-1111-111111111111';
  const validUUID2 = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [MulterModule.register()],
      controllers: [ProfessionalsController],
      providers: [
        { provide: ProfessionalsService, useValue: mockService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------
  // GET /professionals
  // -------------------------------------------------------
  describe('GET /professionals', () => {
    it('should return 200 and call findAll without serviceId', async () => {
      const expected = [{ id: validUUID, name: 'Ana' }];
      mockService.findAll.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .get('/professionals')
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.findAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should pass serviceId query param to findAll', async () => {
      mockService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(`/professionals?serviceId=${validUUID}`)
        .expect(200);

      expect(mockService.findAll).toHaveBeenCalledWith(validUUID, undefined);
    });
  });

  // -------------------------------------------------------
  // GET /professionals/active
  // -------------------------------------------------------
  describe('GET /professionals/active', () => {
    it('should return 200 and call findActive', async () => {
      const expected = [{ id: validUUID, name: 'Ana', serviceIds: [] }];
      mockService.findActive.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .get('/professionals/active')
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.findActive).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // GET /professionals/available-for-booking
  // -------------------------------------------------------
  describe('GET /professionals/available-for-booking', () => {
    it('should return 200, split serviceIds by comma, and pass date', async () => {
      const expected = [{ id: validUUID, name: 'Ana' }];
      mockService.findAvailableForBooking.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .get(
          `/professionals/available-for-booking?serviceIds=${validUUID},${validUUID2}&date=2025-01-06`,
        )
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.findAvailableForBooking).toHaveBeenCalledWith(
        [validUUID, validUUID2],
        '2025-01-06',
      );
    });
  });

  // -------------------------------------------------------
  // GET /professionals/by-service/:serviceId
  // -------------------------------------------------------
  describe('GET /professionals/by-service/:serviceId', () => {
    it('should return 200 with a valid UUID', async () => {
      const expected = [{ id: validUUID, name: 'Ana' }];
      mockService.findByService.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .get(`/professionals/by-service/${validUUID}`)
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.findByService).toHaveBeenCalledWith(validUUID);
    });

    it('should return 400 with an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/professionals/by-service/not-a-uuid')
        .expect(400);

      expect(mockService.findByService).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // GET /professionals/:id
  // -------------------------------------------------------
  describe('GET /professionals/:id', () => {
    it('should return 200 with a valid UUID', async () => {
      const expected = { id: validUUID, name: 'Ana' };
      mockService.findOne.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .get(`/professionals/${validUUID}`)
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.findOne).toHaveBeenCalledWith(validUUID);
    });

    it('should return 400 with an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/professionals/invalid-uuid')
        .expect(400);

      expect(mockService.findOne).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // GET /professionals/:id/appointments?date=Y
  // -------------------------------------------------------
  describe('GET /professionals/:id/appointments', () => {
    it('should return 200 and pass id and date to getAppointmentsByDate', async () => {
      const expected = [{ id: 'appt-1', status: 'SCHEDULED' }];
      mockService.getAppointmentsByDate.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .get(`/professionals/${validUUID}/appointments?date=2025-01-06`)
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.getAppointmentsByDate).toHaveBeenCalledWith(
        validUUID,
        expect.any(Date),
      );
    });
  });

  // -------------------------------------------------------
  // POST /professionals
  // -------------------------------------------------------
  describe('POST /professionals', () => {
    it('should return 201 and call create with the dto', async () => {
      const dto = { name: 'Ana', phone: '11999999999' };
      const expected = { id: validUUID, ...dto };
      mockService.create.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/professionals')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(expected);
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
    });
  });

  // -------------------------------------------------------
  // POST /professionals/upload-avatar
  // -------------------------------------------------------
  describe('POST /professionals/upload-avatar', () => {
    it('should return 201 and call uploadAvatar with the file', async () => {
      const expected = { url: 'https://storage.example.com/photo.jpg' };
      mockService.uploadAvatar.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/professionals/upload-avatar')
        .attach('file', Buffer.from('fake-image'), 'photo.jpg')
        .expect(201);

      expect(res.body).toEqual(expected);
      expect(mockService.uploadAvatar).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: 'photo.jpg',
          buffer: expect.any(Buffer),
        }),
      );
    });
  });

  // -------------------------------------------------------
  // PATCH /professionals/:id
  // -------------------------------------------------------
  describe('PATCH /professionals/:id', () => {
    it('should return 200 and call update with id and dto', async () => {
      const dto = { name: 'Ana Updated' };
      const expected = { id: validUUID, name: 'Ana Updated' };
      mockService.update.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .patch(`/professionals/${validUUID}`)
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(expected);
      expect(mockService.update).toHaveBeenCalledWith(
        validUUID,
        expect.objectContaining(dto),
      );
    });
  });

  // -------------------------------------------------------
  // DELETE /professionals/:id
  // -------------------------------------------------------
  describe('DELETE /professionals/:id', () => {
    it('should return 204 and call remove with id', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/professionals/${validUUID}`)
        .expect(204);

      expect(mockService.remove).toHaveBeenCalledWith(validUUID);
    });

    it('should return 400 with an invalid UUID', async () => {
      await request(app.getHttpServer())
        .delete('/professionals/not-valid')
        .expect(400);

      expect(mockService.remove).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // NotFoundException → 404
  // -------------------------------------------------------
  describe('when service throws NotFoundException', () => {
    it('GET /professionals/:id should return 404', async () => {
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Profissional não encontrado'),
      );

      const res = await request(app.getHttpServer())
        .get(`/professionals/${validUUID}`)
        .expect(404);

      expect(res.body.message).toBe('Profissional não encontrado');
    });

    it('PATCH /professionals/:id should return 404', async () => {
      mockService.update.mockRejectedValue(
        new NotFoundException('Profissional não encontrado'),
      );

      await request(app.getHttpServer())
        .patch(`/professionals/${validUUID}`)
        .send({ name: 'Test' })
        .expect(404);
    });

    it('DELETE /professionals/:id should return 404', async () => {
      mockService.remove.mockRejectedValue(
        new NotFoundException('Profissional não encontrado'),
      );

      await request(app.getHttpServer())
        .delete(`/professionals/${validUUID}`)
        .expect(404);
    });
  });
});
