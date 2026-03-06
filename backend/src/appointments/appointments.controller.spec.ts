import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AppointmentsController (integration)', () => {
  let app: INestApplication;

  const VALID_UUID = '11111111-1111-4111-a111-111111111111';
  const VALID_UUID_2 = '22222222-2222-4222-a222-222222222222';
  const VALID_UUID_3 = '33333333-3333-4333-a333-333333333333';
  const CLIENT_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  const mockAppointment = {
    id: VALID_UUID,
    clientId: CLIENT_UUID,
    professionalId: VALID_UUID_2,
    scheduledAt: '2025-01-06T10:00:00.000Z',
    status: 'SCHEDULED',
    totalPrice: 100,
    totalDuration: 60,
  };

  const mockService = {
    create: jest.fn().mockResolvedValue(mockAppointment),
    findAll: jest.fn().mockResolvedValue([mockAppointment]),
    findOne: jest.fn().mockResolvedValue(mockAppointment),
    findByClient: jest.fn().mockResolvedValue([mockAppointment]),
    findByProfessionalAndDate: jest.fn().mockResolvedValue([mockAppointment]),
    findUnpaid: jest.fn().mockResolvedValue([mockAppointment]),
    update: jest.fn().mockResolvedValue(mockAppointment),
    cancel: jest.fn().mockResolvedValue({ ...mockAppointment, status: 'CANCELED' }),
    markAsAttended: jest.fn().mockResolvedValue({ ...mockAppointment, status: 'ATTENDED' }),
    markAsNoShow: jest.fn().mockResolvedValue({ ...mockAppointment, status: 'NO_SHOW' }),
    getAvailableSlots: jest.fn().mockResolvedValue([
      { time: '08:00', available: true },
      { time: '08:30', available: true },
    ]),
    getCalendarData: jest.fn().mockResolvedValue([
      { id: VALID_UUID_2, name: 'Professional 1', appointments: [], timeBlocks: [] },
    ]),
    createTimeBlock: jest.fn().mockResolvedValue({
      id: VALID_UUID_3,
      professionalId: VALID_UUID_2,
      startTime: '2025-01-06T12:00:00.000Z',
      endTime: '2025-01-06T13:00:00.000Z',
      reason: 'Lunch break',
    }),
    deleteTimeBlock: jest.fn().mockResolvedValue({ id: VALID_UUID_3 }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: AppointmentsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: CLIENT_UUID, email: 'test@test.com', role: 'CLIENT' };
          return true;
        },
      })
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

  // ─── POST /appointments ───────────────────────────────────────────

  describe('POST /appointments', () => {
    const validDto = {
      clientId: CLIENT_UUID,
      professionalId: VALID_UUID_2,
      serviceIds: [VALID_UUID_3],
      scheduledAt: '2025-01-06T10:00:00.000Z',
    };

    it('should return 201 with valid data', () => {
      return request(app.getHttpServer())
        .post('/appointments')
        .send(validDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual(mockAppointment);
          expect(mockService.create).toHaveBeenCalledWith(
            expect.objectContaining({
              clientId: CLIENT_UUID,
              professionalId: VALID_UUID_2,
              serviceIds: [VALID_UUID_3],
            }),
          );
        });
    });

    it('should return 400 when serviceIds is missing', () => {
      return request(app.getHttpServer())
        .post('/appointments')
        .send({
          clientId: CLIENT_UUID,
          professionalId: VALID_UUID_2,
          scheduledAt: '2025-01-06T10:00:00.000Z',
        })
        .expect(400);
    });

    it('should return 400 when clientId is an invalid UUID', () => {
      return request(app.getHttpServer())
        .post('/appointments')
        .send({
          clientId: 'not-a-uuid',
          professionalId: VALID_UUID_2,
          serviceIds: [VALID_UUID_3],
          scheduledAt: '2025-01-06T10:00:00.000Z',
        })
        .expect(400);
    });

    it('should return 400 when professionalId is an invalid UUID', () => {
      return request(app.getHttpServer())
        .post('/appointments')
        .send({
          clientId: CLIENT_UUID,
          professionalId: 'invalid',
          serviceIds: [VALID_UUID_3],
          scheduledAt: '2025-01-06T10:00:00.000Z',
        })
        .expect(400);
    });

    it('should return 400 when serviceIds contains an invalid UUID', () => {
      return request(app.getHttpServer())
        .post('/appointments')
        .send({
          clientId: CLIENT_UUID,
          professionalId: VALID_UUID_2,
          serviceIds: ['not-a-uuid'],
          scheduledAt: '2025-01-06T10:00:00.000Z',
        })
        .expect(400);
    });

    it('should return 400 when serviceIds is empty', () => {
      return request(app.getHttpServer())
        .post('/appointments')
        .send({
          clientId: CLIENT_UUID,
          professionalId: VALID_UUID_2,
          serviceIds: [],
          scheduledAt: '2025-01-06T10:00:00.000Z',
        })
        .expect(400);
    });
  });

  // ─── POST /appointments/client ────────────────────────────────────

  describe('POST /appointments/client', () => {
    const validClientDto = {
      professionalId: VALID_UUID_2,
      serviceIds: [VALID_UUID_3],
      date: '2025-01-06',
      startTime: '10:00',
    };

    it('should return 201 and use clientId from JWT token', () => {
      return request(app.getHttpServer())
        .post('/appointments/client')
        .send(validClientDto)
        .expect(201)
        .expect((res) => {
          expect(mockService.create).toHaveBeenCalledWith(
            expect.objectContaining({
              clientId: CLIENT_UUID,
              professionalId: VALID_UUID_2,
              serviceIds: [VALID_UUID_3],
            }),
          );
        });
    });
  });

  // ─── GET /appointments/me ─────────────────────────────────────────

  describe('GET /appointments/me', () => {
    it('should return 200 with client appointments from guard user', () => {
      return request(app.getHttpServer())
        .get('/appointments/me')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([mockAppointment]);
          expect(mockService.findByClient).toHaveBeenCalledWith(CLIENT_UUID);
        });
    });
  });

  // ─── GET /appointments ────────────────────────────────────────────

  describe('GET /appointments', () => {
    it('should return 200 with all appointments when no query params', () => {
      return request(app.getHttpServer())
        .get('/appointments')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([mockAppointment]);
          expect(mockService.findAll).toHaveBeenCalled();
        });
    });

    it('should filter by clientId when query param is provided', () => {
      return request(app.getHttpServer())
        .get('/appointments')
        .query({ clientId: CLIENT_UUID })
        .expect(200)
        .expect(() => {
          expect(mockService.findByClient).toHaveBeenCalledWith(CLIENT_UUID);
        });
    });

    it('should filter by professionalId and date range', () => {
      return request(app.getHttpServer())
        .get('/appointments')
        .query({
          professionalId: VALID_UUID_2,
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        })
        .expect(200)
        .expect(() => {
          expect(mockService.findByProfessionalAndDate).toHaveBeenCalledWith(
            VALID_UUID_2,
            expect.any(Date),
            expect.any(Date),
          );
        });
    });
  });

  // ─── GET /appointments/unpaid ─────────────────────────────────────

  describe('GET /appointments/unpaid', () => {
    it('should return 200 with unpaid appointments', () => {
      return request(app.getHttpServer())
        .get('/appointments/unpaid')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([mockAppointment]);
          expect(mockService.findUnpaid).toHaveBeenCalled();
        });
    });
  });

  // ─── GET /appointments/calendar ───────────────────────────────────

  describe('GET /appointments/calendar', () => {
    it('should return 200 with calendar data for a given date', () => {
      return request(app.getHttpServer())
        .get('/appointments/calendar')
        .query({ date: '2025-01-06' })
        .expect(200)
        .expect((res) => {
          expect(mockService.getCalendarData).toHaveBeenCalledWith('2025-01-06');
          expect(res.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: VALID_UUID_2, name: 'Professional 1' }),
            ]),
          );
        });
    });
  });

  // ─── GET /appointments/available-slots ────────────────────────────

  describe('GET /appointments/available-slots', () => {
    it('should return 200 with available slots', () => {
      return request(app.getHttpServer())
        .get('/appointments/available-slots')
        .query({ professionalId: VALID_UUID_2, date: '2025-01-06' })
        .expect(200)
        .expect((res) => {
          expect(mockService.getAvailableSlots).toHaveBeenCalledWith(VALID_UUID_2, '2025-01-06');
          expect(res.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ time: '08:00', available: true }),
            ]),
          );
        });
    });
  });

  // ─── GET /appointments/:id ────────────────────────────────────────

  describe('GET /appointments/:id', () => {
    it('should return 200 with a valid UUID', () => {
      return request(app.getHttpServer())
        .get(`/appointments/${VALID_UUID}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual(mockAppointment);
          expect(mockService.findOne).toHaveBeenCalledWith(VALID_UUID);
        });
    });

    it('should return 400 with an invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/appointments/not-a-valid-uuid')
        .expect(400);
    });
  });

  // ─── PATCH /appointments/:id ──────────────────────────────────────

  describe('PATCH /appointments/:id', () => {
    it('should return 200 when updating with a valid UUID', () => {
      return request(app.getHttpServer())
        .patch(`/appointments/${VALID_UUID}`)
        .send({ notes: 'Updated note' })
        .expect(200)
        .expect((res) => {
          expect(mockService.update).toHaveBeenCalledWith(
            VALID_UUID,
            expect.objectContaining({}),
          );
        });
    });
  });

  // ─── PATCH /appointments/:id/cancel ───────────────────────────────

  describe('PATCH /appointments/:id/cancel', () => {
    it('should return 200 when canceling with a valid UUID', () => {
      return request(app.getHttpServer())
        .patch(`/appointments/${VALID_UUID}/cancel`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('CANCELED');
          expect(mockService.cancel).toHaveBeenCalledWith(VALID_UUID);
        });
    });

    it('should return 400 with an invalid UUID', () => {
      return request(app.getHttpServer())
        .patch('/appointments/bad-uuid/cancel')
        .expect(400);
    });
  });

  // ─── PATCH /appointments/:id/attend ───────────────────────────────

  describe('PATCH /appointments/:id/attend', () => {
    it('should return 200 when marking as attended', () => {
      return request(app.getHttpServer())
        .patch(`/appointments/${VALID_UUID}/attend`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ATTENDED');
          expect(mockService.markAsAttended).toHaveBeenCalledWith(VALID_UUID);
        });
    });

    it('should return 400 with an invalid UUID', () => {
      return request(app.getHttpServer())
        .patch('/appointments/bad-uuid/attend')
        .expect(400);
    });
  });

  // ─── PATCH /appointments/:id/no-show ──────────────────────────────

  describe('PATCH /appointments/:id/no-show', () => {
    it('should return 200 when marking as no-show', () => {
      return request(app.getHttpServer())
        .patch(`/appointments/${VALID_UUID}/no-show`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('NO_SHOW');
          expect(mockService.markAsNoShow).toHaveBeenCalledWith(VALID_UUID);
        });
    });

    it('should return 400 with an invalid UUID', () => {
      return request(app.getHttpServer())
        .patch('/appointments/bad-uuid/no-show')
        .expect(400);
    });
  });

  // ─── POST /appointments/block ─────────────────────────────────────

  describe('POST /appointments/block', () => {
    it('should return 201 when creating a time block', () => {
      return request(app.getHttpServer())
        .post('/appointments/block')
        .send({
          professionalId: VALID_UUID_2,
          startTime: '2025-01-06T12:00:00.000Z',
          endTime: '2025-01-06T13:00:00.000Z',
          reason: 'Lunch break',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              id: VALID_UUID_3,
              professionalId: VALID_UUID_2,
            }),
          );
          expect(mockService.createTimeBlock).toHaveBeenCalled();
        });
    });
  });

  // ─── DELETE /appointments/block/:id ───────────────────────────────

  describe('DELETE /appointments/block/:id', () => {
    it('should return 200 when deleting a time block with valid UUID', () => {
      return request(app.getHttpServer())
        .delete(`/appointments/block/${VALID_UUID_3}`)
        .expect(200)
        .expect(() => {
          expect(mockService.deleteTimeBlock).toHaveBeenCalledWith(VALID_UUID_3);
        });
    });

    it('should return 400 with an invalid UUID', () => {
      return request(app.getHttpServer())
        .delete('/appointments/block/invalid-uuid')
        .expect(400);
    });
  });

  // ─── Error propagation ────────────────────────────────────────────

  describe('Error handling', () => {
    it('should return 404 when service throws NotFoundException', () => {
      mockService.findOne.mockRejectedValueOnce(
        new NotFoundException('Agendamento não encontrado'),
      );

      return request(app.getHttpServer())
        .get(`/appointments/${VALID_UUID}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Agendamento não encontrado');
        });
    });

    it('should return 404 when cancel throws NotFoundException', () => {
      mockService.cancel.mockRejectedValueOnce(
        new NotFoundException('Agendamento não encontrado'),
      );

      return request(app.getHttpServer())
        .patch(`/appointments/${VALID_UUID}/cancel`)
        .expect(404);
    });

    it('should return 400 when service throws BadRequestException', () => {
      mockService.create.mockRejectedValueOnce(
        new BadRequestException('Profissional não está ativo'),
      );

      return request(app.getHttpServer())
        .post('/appointments')
        .send({
          clientId: CLIENT_UUID,
          professionalId: VALID_UUID_2,
          serviceIds: [VALID_UUID_3],
          scheduledAt: '2025-01-06T10:00:00.000Z',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Profissional não está ativo');
        });
    });

    it('should return 400 when markAsAttended throws BadRequestException', () => {
      mockService.markAsAttended.mockRejectedValueOnce(
        new BadRequestException('Não é possível marcar como atendido um agendamento cancelado'),
      );

      return request(app.getHttpServer())
        .patch(`/appointments/${VALID_UUID}/attend`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Não é possível marcar como atendido um agendamento cancelado',
          );
        });
    });

    it('should return 404 when deleteTimeBlock throws NotFoundException', () => {
      mockService.deleteTimeBlock.mockRejectedValueOnce(
        new NotFoundException('Bloqueio não encontrado'),
      );

      return request(app.getHttpServer())
        .delete(`/appointments/block/${VALID_UUID_3}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Bloqueio não encontrado');
        });
    });
  });
});
