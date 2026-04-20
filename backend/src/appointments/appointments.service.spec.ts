jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('mock-uuid-123'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { CreateAppointmentDto } from './dto';

const mockAsaasService = {
  configured: false,
  centavosToReais: jest.fn((v: number) => v / 100),
  createCustomer: jest.fn(),
  findCustomerByExternalReference: jest.fn(),
  createCharge: jest.fn(),
  cancelCharge: jest.fn().mockResolvedValue(undefined),
  getPixQrCode: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helper: build a chainable mock for a single Supabase table
// ---------------------------------------------------------------------------
const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.neq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.is = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn();
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let chains: Record<string, any>;
  let mockSupabase: { from: jest.Mock };

  beforeEach(async () => {
    chains = {};

    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (!chains[table]) chains[table] = mockChain();
        return chains[table];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AsaasService, useValue: mockAsaasService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------
  describe('create', () => {
    const dto: CreateAppointmentDto = {
      clientId: 'client-1',
      professionalId: 'prof-1',
      serviceIds: ['svc-1', 'svc-2'],
      scheduledAt: new Date('2026-04-01T10:00:00Z'),
      notes: 'test note',
    };

    /**
     * Cobre o fluxo atual de create():
     *   1. services.in().eq()  (terminal)
     *   2. promotions.gte()    (terminal, via getActivePromotions)
     *   3. client_subscriptions.maybeSingle() (terminal, via getClientPlanDiscount)
     *   4. validateScheduleConflicts:
     *        professionals.single() + time_blocks + appointments (conflict)
     *   5. clients.single()
     *   6. appointments.insert().select().single()
     *   7. appointment_services.insert() (N vezes) + orders.insert() + order_items.insert()
     */
    function setupCreateSuccess() {
      // services (terminal = .eq())
      chains['services'] = mockChain();
      chains['services'].eq.mockResolvedValue({
        data: [
          { id: 'svc-1', price: 10000, duration: 30 },
          { id: 'svc-2', price: 5000, duration: 20 },
        ],
        error: null,
      });

      // promotions (terminal = .gte())
      chains['promotions'] = mockChain();
      chains['promotions'].gte.mockResolvedValue({
        data: [
          {
            discountPercent: 10,
            promotion_services: [{ serviceId: 'svc-1' }],
          },
        ],
        error: null,
      });

      // client_subscriptions — sem assinatura ativa
      chains['client_subscriptions'] = mockChain();
      chains['client_subscriptions'].maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      // professionals (usado em validateScheduleConflicts)
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-1', isActive: true, workingHours: [] },
        error: null,
      });

      // time_blocks (terminal = .lte()) — nenhum bloqueio
      chains['time_blocks'] = mockChain();
      chains['time_blocks'].lte.mockResolvedValue({ data: [], error: null });

      // clients (.single())
      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      // appointments — usado primeiro para conflito (.lte()) e depois para insert (.single())
      // Não há agendamentos conflitantes, e o insert retorna o mock-uuid-123.
      chains['appointments'] = mockChain();
      chains['appointments'].lte.mockResolvedValue({ data: [], error: null });
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'mock-uuid-123', status: 'SCHEDULED' },
        error: null,
      });

      // appointment_services, orders, order_items — inserts sem retorno
      chains['appointment_services'] = mockChain();
      chains['appointment_services'].insert.mockReturnValue(
        Promise.resolve({ data: null, error: null }) as any,
      );

      chains['orders'] = mockChain();
      chains['orders'].insert.mockReturnValue(
        Promise.resolve({ data: null, error: null }) as any,
      );

      chains['order_items'] = mockChain();
      chains['order_items'].insert.mockReturnValue(
        Promise.resolve({ data: null, error: null }) as any,
      );
    }

    it('should create an appointment with promotional pricing', async () => {
      setupCreateSuccess();

      const result = await service.create(dto);

      // Retorno envolve o appointment em { ...appointment, payment: null } quando Asaas não configurado
      expect(result).toMatchObject({ id: 'mock-uuid-123', status: 'SCHEDULED', payment: null });

      // Verify professional lookup (via validateScheduleConflicts)
      expect(chains['professionals'].select).toHaveBeenCalledWith('id, isActive, workingHours');
      expect(chains['professionals'].eq).toHaveBeenCalledWith('id', 'prof-1');

      // Verify services lookup
      expect(chains['services'].in).toHaveBeenCalledWith('id', ['svc-1', 'svc-2']);

      // Verify appointment insert includes promotional pricing:
      // svc-1: 10000 * 90/100 = 9000, svc-2: 5000 (no promo) => total 14000
      const insertCall = chains['appointments'].insert.mock.calls[0][0];
      expect(insertCall.totalPrice).toBe(14000);
      expect(insertCall.totalDuration).toBe(50);
      expect(insertCall.status).toBe('SCHEDULED');
      expect(insertCall.id).toBe('mock-uuid-123');

      // Verify service links created
      expect(chains['appointment_services'].insert).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when professional not found', async () => {
      // services precisa passar antes de chegar em validateScheduleConflicts
      chains['services'] = mockChain();
      chains['services'].eq.mockResolvedValue({
        data: [
          { id: 'svc-1', price: 10000, duration: 30 },
          { id: 'svc-2', price: 5000, duration: 20 },
        ],
        error: null,
      });

      chains['promotions'] = mockChain();
      chains['promotions'].gte.mockResolvedValue({ data: [], error: null });

      chains['client_subscriptions'] = mockChain();
      chains['client_subscriptions'].maybeSingle.mockResolvedValue({ data: null, error: null });

      // Profissional não encontrado → NotFoundException
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when professional is inactive', async () => {
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-1', isActive: false },
        error: null,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when services not found', async () => {
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-1', isActive: true },
        error: null,
      });

      chains['services'] = mockChain();
      // Return only 1 service when 2 were requested
      chains['services'].eq.mockResolvedValue({
        data: [{ id: 'svc-1', price: 10000, duration: 30 }],
        error: null,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when client not found', async () => {
      chains['services'] = mockChain();
      chains['services'].eq.mockResolvedValue({
        data: [
          { id: 'svc-1', price: 10000, duration: 30 },
          { id: 'svc-2', price: 5000, duration: 20 },
        ],
        error: null,
      });

      chains['promotions'] = mockChain();
      chains['promotions'].gte.mockResolvedValue({ data: [], error: null });

      chains['client_subscriptions'] = mockChain();
      chains['client_subscriptions'].maybeSingle.mockResolvedValue({ data: null, error: null });

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-1', isActive: true, workingHours: [] },
        error: null,
      });

      chains['time_blocks'] = mockChain();
      chains['time_blocks'].lte.mockResolvedValue({ data: [], error: null });

      // appointments conflict check — sem conflito
      chains['appointments'] = mockChain();
      chains['appointments'].lte.mockResolvedValue({ data: [], error: null });

      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // cancel()
  // -----------------------------------------------------------------------
  describe('cancel', () => {
    it('should cancel a SCHEDULED appointment', async () => {
      const chain = mockChain();
      chains['appointments'] = chain;

      // First call: select().eq().single() to fetch status
      // Second call: update().eq().select().single() to update
      chain.single
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'SCHEDULED' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'CANCELED' },
          error: null,
        });

      const result = await service.cancel('appt-1');
      expect(result).toEqual({ id: 'appt-1', status: 'CANCELED' });
      expect(chain.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when appointment not found', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.cancel('appt-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already ATTENDED', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'ATTENDED' },
        error: null,
      });

      await expect(service.cancel('appt-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when already CANCELED', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'CANCELED' },
        error: null,
      });

      await expect(service.cancel('appt-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // markAsAttended()
  // -----------------------------------------------------------------------
  describe('markAsAttended', () => {
    it('should mark a SCHEDULED appointment as ATTENDED', async () => {
      const chain = mockChain();
      chains['appointments'] = chain;

      chain.single
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'SCHEDULED' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'ATTENDED' },
          error: null,
        });

      // Service agora consulta payments para eventual cobrança online pendente
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({ data: null, error: null });

      const result = await service.markAsAttended('appt-1');
      expect(result).toEqual({ id: 'appt-1', status: 'ATTENDED' });
    });

    it('should throw BadRequestException when CANCELED', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'CANCELED' },
        error: null,
      });

      await expect(service.markAsAttended('appt-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when already ATTENDED', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'ATTENDED' },
        error: null,
      });

      await expect(service.markAsAttended('appt-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // markAsNoShow()
  // -----------------------------------------------------------------------
  describe('markAsNoShow', () => {
    it('should mark a SCHEDULED appointment as NO_SHOW', async () => {
      const chain = mockChain();
      chains['appointments'] = chain;

      chain.single
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'SCHEDULED' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'NO_SHOW' },
          error: null,
        });

      const result = await service.markAsNoShow('appt-1');
      expect(result).toEqual({ id: 'appt-1', status: 'NO_SHOW' });
    });

    it('should throw BadRequestException when not SCHEDULED', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'CANCELED' },
        error: null,
      });

      await expect(service.markAsNoShow('appt-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // findOne()
  // -----------------------------------------------------------------------
  describe('findOne', () => {
    it('should return an appointment by id', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'SCHEDULED' },
        error: null,
      });

      const result = await service.findOne('appt-1');
      expect(result).toEqual({ id: 'appt-1', status: 'SCHEDULED' });
    });

    it('should throw NotFoundException when not found', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.findOne('appt-1')).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------
  describe('findAll', () => {
    it('should return an array of appointments', async () => {
      const chain = mockChain();
      chains['appointments'] = chain;

      const mockAppointments = [
        { id: 'appt-1', status: 'SCHEDULED' },
        { id: 'appt-2', status: 'ATTENDED' },
      ];
      // findAll calls .order() which returns the chain; the chain itself
      // must resolve as a thenable. Override order to resolve with data.
      chain.order.mockResolvedValue({
        data: mockAppointments,
        error: null,
      });

      const result = await service.findAll();
      expect(result).toEqual(mockAppointments);
    });

    it('should return empty array when data is null', async () => {
      const chain = mockChain();
      chains['appointments'] = chain;
      chain.order.mockResolvedValue({ data: null, error: null });

      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------
  describe('update', () => {
    it('should update a SCHEDULED appointment', async () => {
      const chain = mockChain();
      chains['appointments'] = chain;

      chain.single
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'SCHEDULED' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'appt-1', status: 'SCHEDULED', notes: 'updated' },
          error: null,
        });

      const result = await service.update('appt-1', { notes: 'updated' });
      expect(result).toEqual({ id: 'appt-1', status: 'SCHEDULED', notes: 'updated' });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.update('appt-1', { notes: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when not SCHEDULED', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', status: 'ATTENDED' },
        error: null,
      });

      await expect(service.update('appt-1', { notes: 'x' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // getCalendarData()
  // -----------------------------------------------------------------------
  describe('getCalendarData', () => {
    it('should return professionals with their appointments and time blocks', async () => {
      // professionals chain -> .order() resolves
      chains['professionals'] = mockChain();
      chains['professionals'].order.mockResolvedValue({
        data: [
          { id: 'prof-1', name: 'Alice', phone: '123', workingHours: {} },
          { id: 'prof-2', name: 'Bob', phone: '456', workingHours: {} },
        ],
        error: null,
      });

      // appointments — terminal agora é .neq('status', 'CANCELED') (filtra cancelados)
      chains['appointments'] = mockChain();
      chains['appointments'].neq.mockResolvedValue({
        data: [
          { id: 'appt-1', professionalId: 'prof-1', scheduledAt: '2026-04-01T10:00:00Z' },
          { id: 'appt-2', professionalId: 'prof-2', scheduledAt: '2026-04-01T11:00:00Z' },
        ],
        error: null,
      });

      // time_blocks chain -> .lte() resolves
      chains['time_blocks'] = mockChain();
      chains['time_blocks'].lte.mockResolvedValue({
        data: [
          { id: 'tb-1', professionalId: 'prof-1', startTime: '2026-04-01T12:00:00Z', endTime: '2026-04-01T13:00:00Z', reason: 'Lunch' },
        ],
        error: null,
      });

      const result = await service.getCalendarData('2026-04-01');

      expect(result).toHaveLength(2);

      // Alice has 1 appointment and 1 time block
      expect(result[0].id).toBe('prof-1');
      expect(result[0].appointments).toHaveLength(1);
      expect(result[0].appointments[0].id).toBe('appt-1');
      expect(result[0].timeBlocks).toHaveLength(1);
      expect(result[0].timeBlocks[0].id).toBe('tb-1');

      // Bob has 1 appointment and 0 time blocks
      expect(result[1].id).toBe('prof-2');
      expect(result[1].appointments).toHaveLength(1);
      expect(result[1].timeBlocks).toHaveLength(0);
    });

    it('should return empty arrays when no data exists', async () => {
      chains['professionals'] = mockChain();
      chains['professionals'].order.mockResolvedValue({
        data: [],
        error: null,
      });

      chains['appointments'] = mockChain();
      chains['appointments'].neq.mockResolvedValue({ data: null, error: null });

      chains['time_blocks'] = mockChain();
      chains['time_blocks'].lte.mockResolvedValue({ data: null, error: null });

      const result = await service.getCalendarData('2026-04-01');
      expect(result).toEqual([]);
    });
  });
});
