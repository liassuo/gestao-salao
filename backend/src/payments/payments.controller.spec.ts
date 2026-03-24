import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as request from 'supertest';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let app: INestApplication;

  const validUUID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
  const clientId = '11111111-1111-4111-a111-111111111111';
  const registeredBy = '22222222-2222-4222-a222-222222222222';
  const appointmentId = '33333333-3333-4333-a333-333333333333';

  const validPaymentDto = {
    clientId,
    amount: 5000,
    method: 'PIX',
    registeredBy,
  };

  const mockPayment = {
    id: validUUID,
    clientId,
    amount: 5000,
    method: 'PIX',
    registeredBy,
    paidAt: '2026-03-06T10:00:00.000Z',
    notes: null,
    appointmentId: null,
  };

  const mockService = {
    registerPayment: jest.fn(),
    findAll: jest.fn(),
    findByDateRange: jest.fn(),
    findByClient: jest.fn(),
    findByMethod: jest.fn(),
    calculateTotalsByMethod: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    unlinkPayment: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockService }],
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

  // ─── POST /payments ───────────────────────────────────────────────────────────

  describe('POST /payments', () => {
    it('should return 201 with valid data', async () => {
      mockService.registerPayment.mockResolvedValue(mockPayment);

      const res = await request(app.getHttpServer())
        .post('/payments')
        .send(validPaymentDto)
        .expect(201);

      expect(res.body).toEqual(mockPayment);
      expect(mockService.registerPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId,
          amount: 5000,
          method: 'PIX',
          registeredBy,
        }),
      );
    });

    it('should return 201 with all optional fields', async () => {
      const fullDto = {
        ...validPaymentDto,
        appointmentId,
        paidAt: '2026-03-06T10:00:00.000Z',
        notes: 'Pagamento parcial',
      };
      mockService.registerPayment.mockResolvedValue({
        ...mockPayment,
        appointmentId,
        notes: 'Pagamento parcial',
      });

      await request(app.getHttpServer())
        .post('/payments')
        .send(fullDto)
        .expect(201);

      expect(mockService.registerPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId,
          notes: 'Pagamento parcial',
        }),
      );
    });

    it('should return 400 with negative amount', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ ...validPaymentDto, amount: -100 })
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with zero amount', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ ...validPaymentDto, amount: 0 })
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with non-integer amount', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ ...validPaymentDto, amount: 50.5 })
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with invalid method', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ ...validPaymentDto, method: 'BITCOIN' })
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with missing clientId', async () => {
      const { clientId: _, ...noClient } = validPaymentDto;

      await request(app.getHttpServer())
        .post('/payments')
        .send(noClient)
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with missing amount', async () => {
      const { amount: _, ...noAmount } = validPaymentDto;

      await request(app.getHttpServer())
        .post('/payments')
        .send(noAmount)
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with missing method', async () => {
      const { method: _, ...noMethod } = validPaymentDto;

      await request(app.getHttpServer())
        .post('/payments')
        .send(noMethod)
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with missing registeredBy', async () => {
      const { registeredBy: _, ...noRegisteredBy } = validPaymentDto;

      await request(app.getHttpServer())
        .post('/payments')
        .send(noRegisteredBy)
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with invalid clientId (not UUID)', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ ...validPaymentDto, clientId: 'not-a-uuid' })
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });

    it('should return 400 with invalid registeredBy (not UUID)', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ ...validPaymentDto, registeredBy: 'not-a-uuid' })
        .expect(400);

      expect(mockService.registerPayment).not.toHaveBeenCalled();
    });
  });

  // ─── GET /payments ────────────────────────────────────────────────────────────

  describe('GET /payments', () => {
    it('should return 200 and call findAll when no query params', async () => {
      mockService.findAll.mockResolvedValue([mockPayment]);

      const res = await request(app.getHttpServer())
        .get('/payments')
        .expect(200);

      expect(res.body).toEqual([mockPayment]);
      expect(mockService.findAll).toHaveBeenCalled();
    });

    it('should call findByDateRange when startDate and endDate are provided', async () => {
      const start = '2026-01-01';
      const end = '2026-01-31';
      mockService.findByDateRange.mockResolvedValue([mockPayment]);

      const res = await request(app.getHttpServer())
        .get('/payments')
        .query({ startDate: start, endDate: end })
        .expect(200);

      expect(res.body).toEqual([mockPayment]);
      expect(mockService.findByDateRange).toHaveBeenCalledWith(
        `${start}T00:00:00`,
        `${end}T23:59:59`,
      );
      expect(mockService.findAll).not.toHaveBeenCalled();
    });

    it('should call findByClient when clientId is provided', async () => {
      mockService.findByClient.mockResolvedValue([mockPayment]);

      const res = await request(app.getHttpServer())
        .get('/payments')
        .query({ clientId })
        .expect(200);

      expect(res.body).toEqual([mockPayment]);
      expect(mockService.findByClient).toHaveBeenCalledWith(clientId);
      expect(mockService.findAll).not.toHaveBeenCalled();
    });

    it('should call findByMethod when method is provided', async () => {
      mockService.findByMethod.mockResolvedValue([mockPayment]);

      const res = await request(app.getHttpServer())
        .get('/payments')
        .query({ method: 'PIX' })
        .expect(200);

      expect(res.body).toEqual([mockPayment]);
      expect(mockService.findByMethod).toHaveBeenCalledWith('PIX');
      expect(mockService.findAll).not.toHaveBeenCalled();
    });

    it('should prioritize date range over clientId and method', async () => {
      mockService.findByDateRange.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/payments')
        .query({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          clientId,
          method: 'PIX',
        })
        .expect(200);

      expect(mockService.findByDateRange).toHaveBeenCalled();
      expect(mockService.findByClient).not.toHaveBeenCalled();
      expect(mockService.findByMethod).not.toHaveBeenCalled();
    });

    it('should prioritize clientId over method', async () => {
      mockService.findByClient.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/payments')
        .query({ clientId, method: 'PIX' })
        .expect(200);

      expect(mockService.findByClient).toHaveBeenCalled();
      expect(mockService.findByMethod).not.toHaveBeenCalled();
    });
  });

  // ─── GET /payments/totals ─────────────────────────────────────────────────────

  describe('GET /payments/totals', () => {
    const totalsResult = { cash: 1000, pix: 3000, card: 2000, total: 6000 };

    it('should return 200 with date range provided', async () => {
      mockService.calculateTotalsByMethod.mockResolvedValue(totalsResult);

      const res = await request(app.getHttpServer())
        .get('/payments/totals')
        .query({ startDate: '2026-01-01', endDate: '2026-01-31' })
        .expect(200);

      expect(res.body).toEqual(totalsResult);
      expect(mockService.calculateTotalsByMethod).toHaveBeenCalledWith(
        '2026-01-01T00:00:00',
        '2026-01-31T23:59:59',
      );
    });

    it('should return 200 and use today as default when no dates provided', async () => {
      mockService.calculateTotalsByMethod.mockResolvedValue(totalsResult);

      const res = await request(app.getHttpServer())
        .get('/payments/totals')
        .expect(200);

      expect(res.body).toEqual(totalsResult);
      expect(mockService.calculateTotalsByMethod).toHaveBeenCalledWith(
        expect.stringMatching(/T00:00:00$/),
        expect.stringMatching(/T23:59:59$/),
      );
    });
  });

  // ─── GET /payments/:id ────────────────────────────────────────────────────────

  describe('GET /payments/:id', () => {
    it('should return 200 with a valid UUID', async () => {
      mockService.findOne.mockResolvedValue(mockPayment);

      const res = await request(app.getHttpServer())
        .get(`/payments/${validUUID}`)
        .expect(200);

      expect(res.body).toEqual(mockPayment);
      expect(mockService.findOne).toHaveBeenCalledWith(validUUID);
    });

    it('should return 400 with an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/payments/not-a-valid-uuid')
        .expect(400);

      expect(mockService.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── PATCH /payments/:id ──────────────────────────────────────────────────────

  describe('PATCH /payments/:id', () => {
    it('should return 200 with valid update data', async () => {
      const updatedPayment = { ...mockPayment, amount: 7500 };
      mockService.update.mockResolvedValue(updatedPayment);

      const res = await request(app.getHttpServer())
        .patch(`/payments/${validUUID}`)
        .send({ amount: 7500 })
        .expect(200);

      expect(res.body).toEqual(updatedPayment);
      expect(mockService.update).toHaveBeenCalledWith(
        validUUID,
        expect.objectContaining({ amount: 7500 }),
      );
    });

    it('should return 200 when updating method', async () => {
      const updatedPayment = { ...mockPayment, method: 'CARD' };
      mockService.update.mockResolvedValue(updatedPayment);

      const res = await request(app.getHttpServer())
        .patch(`/payments/${validUUID}`)
        .send({ method: 'CARD' })
        .expect(200);

      expect(res.body).toEqual(updatedPayment);
    });

    it('should return 200 when updating notes', async () => {
      const updatedPayment = { ...mockPayment, notes: 'Updated note' };
      mockService.update.mockResolvedValue(updatedPayment);

      await request(app.getHttpServer())
        .patch(`/payments/${validUUID}`)
        .send({ notes: 'Updated note' })
        .expect(200);
    });

    it('should return 400 with invalid UUID', async () => {
      await request(app.getHttpServer())
        .patch('/payments/not-a-valid-uuid')
        .send({ amount: 7500 })
        .expect(400);

      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  // ─── DELETE /payments/:id ─────────────────────────────────────────────────────

  describe('DELETE /payments/:id', () => {
    it('should return 204 on successful deletion', async () => {
      mockService.unlinkPayment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/payments/${validUUID}`)
        .expect(204);

      expect(mockService.unlinkPayment).toHaveBeenCalledWith(validUUID);
    });

    it('should return 400 with invalid UUID', async () => {
      await request(app.getHttpServer())
        .delete('/payments/not-a-valid-uuid')
        .expect(400);

      expect(mockService.unlinkPayment).not.toHaveBeenCalled();
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('should return 404 when service throws NotFoundException on findOne', async () => {
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Pagamento nao encontrado'),
      );

      await request(app.getHttpServer())
        .get(`/payments/${validUUID}`)
        .expect(404);
    });

    it('should return 404 when service throws NotFoundException on update', async () => {
      mockService.update.mockRejectedValue(
        new NotFoundException('Pagamento nao encontrado'),
      );

      await request(app.getHttpServer())
        .patch(`/payments/${validUUID}`)
        .send({ amount: 1000 })
        .expect(404);
    });

    it('should return 404 when service throws NotFoundException on delete', async () => {
      mockService.unlinkPayment.mockRejectedValue(
        new NotFoundException('Pagamento nao encontrado'),
      );

      await request(app.getHttpServer())
        .delete(`/payments/${validUUID}`)
        .expect(404);
    });

    it('should return 404 when service throws NotFoundException on registerPayment', async () => {
      mockService.registerPayment.mockRejectedValue(
        new NotFoundException('Cliente nao encontrado'),
      );

      await request(app.getHttpServer())
        .post('/payments')
        .send(validPaymentDto)
        .expect(404);
    });

    it('should return 400 when service throws BadRequestException on registerPayment', async () => {
      mockService.registerPayment.mockRejectedValue(
        new BadRequestException('Este agendamento ja esta pago'),
      );

      await request(app.getHttpServer())
        .post('/payments')
        .send(validPaymentDto)
        .expect(400);
    });

    it('should return 400 when service throws BadRequestException on update', async () => {
      mockService.update.mockRejectedValue(
        new BadRequestException('Dados invalidos'),
      );

      await request(app.getHttpServer())
        .patch(`/payments/${validUUID}`)
        .send({ amount: 1000 })
        .expect(400);
    });
  });
});
