import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';

const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
};

let chains: Record<string, any> = {};

const mockSupabase = {
  from: jest.fn().mockImplementation((table: string) => {
    if (!chains[table]) chains[table] = mockChain();
    return chains[table];
  }),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    chains = {};
    mockSupabase.from.mockClear();
    mockSupabase.from.mockImplementation((table: string) => {
      if (!chains[table]) chains[table] = mockChain();
      return chains[table];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // registerPayment
  // ---------------------------------------------------------------------------
  describe('registerPayment', () => {
    const baseDto: CreatePaymentDto = {
      clientId: 'client-1',
      amount: 5000,
      method: 'PIX' as any,
      registeredBy: 'user-1',
    };

    it('should register a payment without appointmentId', async () => {
      const expectedPayment = { id: 'pay-1', ...baseDto };

      // client exists
      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      // user exists
      chains['users'] = mockChain();
      chains['users'].single.mockResolvedValue({
        data: { id: 'user-1' },
        error: null,
      });

      // payment insert
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: expectedPayment,
        error: null,
      });

      // no open cash register
      chains['cash_registers'] = mockChain();
      chains['cash_registers'].single.mockResolvedValue({ data: null, error: null });

      const result = await service.registerPayment(baseDto);

      expect(result).toEqual(expectedPayment);
      expect(mockSupabase.from).toHaveBeenCalledWith('clients');
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.from).toHaveBeenCalledWith('payments');
    });

    it('should register a payment with appointmentId and mark appointment as paid', async () => {
      const dto: CreatePaymentDto = {
        ...baseDto,
        appointmentId: 'appt-1',
      };
      const expectedPayment = { id: 'pay-1', ...dto };

      // client exists
      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      // user exists
      chains['users'] = mockChain();
      chains['users'].single.mockResolvedValue({
        data: { id: 'user-1' },
        error: null,
      });

      // appointment exists, not paid, belongs to client
      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', isPaid: false, clientId: 'client-1' },
        error: null,
      });

      // payment insert
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: expectedPayment,
        error: null,
      });

      // no open cash register
      chains['cash_registers'] = mockChain();
      chains['cash_registers'].single.mockResolvedValue({ data: null, error: null });

      const result = await service.registerPayment(dto);

      expect(result).toEqual(expectedPayment);
      // appointments.update called to mark as paid (from is called again for update)
      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
    });

    it('should throw NotFoundException when client not found', async () => {
      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.registerPayment(baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when registeredBy user not found', async () => {
      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      chains['users'] = mockChain();
      chains['users'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.registerPayment(baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when appointment not found', async () => {
      const dto: CreatePaymentDto = { ...baseDto, appointmentId: 'appt-99' };

      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      chains['users'] = mockChain();
      chains['users'].single.mockResolvedValue({
        data: { id: 'user-1' },
        error: null,
      });

      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.registerPayment(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when appointment is already paid', async () => {
      const dto: CreatePaymentDto = { ...baseDto, appointmentId: 'appt-1' };

      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      chains['users'] = mockChain();
      chains['users'].single.mockResolvedValue({
        data: { id: 'user-1' },
        error: null,
      });

      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', isPaid: true, clientId: 'client-1' },
        error: null,
      });

      await expect(service.registerPayment(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when appointment belongs to different client', async () => {
      const dto: CreatePaymentDto = { ...baseDto, appointmentId: 'appt-1' };

      chains['clients'] = mockChain();
      chains['clients'].single.mockResolvedValue({
        data: { id: 'client-1' },
        error: null,
      });

      chains['users'] = mockChain();
      chains['users'].single.mockResolvedValue({
        data: { id: 'user-1' },
        error: null,
      });

      chains['appointments'] = mockChain();
      chains['appointments'].single.mockResolvedValue({
        data: { id: 'appt-1', isPaid: false, clientId: 'other-client' },
        error: null,
      });

      await expect(service.registerPayment(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // unlinkPayment
  // ---------------------------------------------------------------------------
  describe('unlinkPayment', () => {
    it('should unmark appointment as paid and delete payment when appointmentId exists', async () => {
      chains['payments'] = mockChain();
      // first call: select to find payment
      chains['payments'].single.mockResolvedValue({
        data: { id: 'pay-1', appointmentId: 'appt-1' },
        error: null,
      });

      chains['appointments'] = mockChain();

      await service.unlinkPayment('pay-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('payments');
      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
    });

    it('should delete payment without updating appointments when no appointmentId', async () => {
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: { id: 'pay-1', appointmentId: null },
        error: null,
      });

      await service.unlinkPayment('pay-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('payments');
      // appointments should not have been accessed
      expect(chains['appointments']).toBeUndefined();
    });

    it('should throw NotFoundException when payment not found', async () => {
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.unlinkPayment('pay-99')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return a payment when found', async () => {
      const payment = { id: 'pay-1', amount: 5000, method: 'PIX' };

      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: payment,
        error: null,
      });

      const result = await service.findOne('pay-1');
      expect(result).toEqual(payment);
    });

    it('should throw NotFoundException when payment not found', async () => {
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.findOne('pay-99')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return array of payments ordered by paidAt desc', async () => {
      const payments = [
        { id: 'pay-2', paidAt: '2026-01-02' },
        { id: 'pay-1', paidAt: '2026-01-01' },
      ];

      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: payments,
        error: null,
      });

      const result = await service.findAll();
      expect(result).toEqual(payments);
    });

    it('should return empty array when no payments exist', async () => {
      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findByClient
  // ---------------------------------------------------------------------------
  describe('findByClient', () => {
    it('should return payments for a specific client', async () => {
      const payments = [
        { id: 'pay-1', clientId: 'client-1', amount: 3000 },
      ];

      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: payments,
        error: null,
      });

      const result = await service.findByClient('client-1');
      expect(result).toEqual(payments);
    });

    it('should return empty array when client has no payments', async () => {
      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.findByClient('client-99');
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findByDateRange
  // ---------------------------------------------------------------------------
  describe('findByDateRange', () => {
    it('should return payments within the date range', async () => {
      const payments = [
        { id: 'pay-1', paidAt: '2026-01-15T00:00:00.000Z', amount: 2000 },
      ];

      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: payments,
        error: null,
      });

      const start = '2026-01-01T00:00:00';
      const end = '2026-01-31T23:59:59';
      const result = await service.findByDateRange(start, end);

      expect(result).toEqual(payments);
    });

    it('should return empty array when no payments in range', async () => {
      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: null,
        error: null,
      });

      const start = '2026-06-01T00:00:00';
      const end = '2026-06-30T23:59:59';
      const result = await service.findByDateRange(start, end);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findByMethod
  // ---------------------------------------------------------------------------
  describe('findByMethod', () => {
    it('should return payments filtered by method', async () => {
      const payments = [
        { id: 'pay-1', method: 'CASH', amount: 1000 },
        { id: 'pay-2', method: 'CASH', amount: 2000 },
      ];

      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: payments,
        error: null,
      });

      const result = await service.findByMethod('CASH');
      expect(result).toEqual(payments);
    });

    it('should return empty array when no payments match the method', async () => {
      chains['payments'] = mockChain();
      chains['payments'].order.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.findByMethod('CARD');
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateTotalsByMethod
  // ---------------------------------------------------------------------------
  describe('calculateTotalsByMethod', () => {
    it('should return totals grouped by method with mixed payments', async () => {
      const payments = [
        { amount: 1000, method: 'CASH' },
        { amount: 2000, method: 'PIX' },
        { amount: 3000, method: 'CARD' },
        { amount: 500, method: 'CASH' },
        { amount: 1500, method: 'PIX' },
      ];

      chains['payments'] = mockChain();
      // calculateTotalsByMethod ends with .lte(), no .order()
      chains['payments'].lte.mockResolvedValue({
        data: payments,
        error: null,
      });

      const start = '2026-01-01T00:00:00';
      const end = '2026-01-31T23:59:59';
      const result = await service.calculateTotalsByMethod(start, end);

      expect(result).toEqual({
        cash: 1500,
        pix: 3500,
        card: 3000,
        total: 8000,
      });
    });

    it('should return all zeros when no payments exist in range', async () => {
      chains['payments'] = mockChain();
      chains['payments'].lte.mockResolvedValue({
        data: null,
        error: null,
      });

      const start = '2026-06-01T00:00:00';
      const end = '2026-06-30T23:59:59';
      const result = await service.calculateTotalsByMethod(start, end);

      expect(result).toEqual({
        cash: 0,
        pix: 0,
        card: 0,
        total: 0,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update and return the payment when found', async () => {
      const updateDto: UpdatePaymentDto = {
        amount: 7500,
        method: 'CARD' as any,
        notes: 'updated note',
      };
      const updatedPayment = { id: 'pay-1', ...updateDto };

      chains['payments'] = mockChain();
      // first single() call: check existence
      // second single() call: return updated record
      chains['payments'].single
        .mockResolvedValueOnce({ data: { id: 'pay-1' }, error: null })
        .mockResolvedValueOnce({ data: updatedPayment, error: null });

      const result = await service.update('pay-1', updateDto);
      expect(result).toEqual(updatedPayment);
    });

    it('should throw NotFoundException when payment to update not found', async () => {
      chains['payments'] = mockChain();
      chains['payments'].single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.update('pay-99', { amount: 1000 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
