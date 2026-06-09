import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CommissionsService } from '../commissions/commissions.service';
import { CashRegisterService } from '../cash-register/cash-register.service';

// Thenable mock chain: `await chain` (queries that don't end in .single/.order)
// resolve to chain.__result; .single/.maybeSingle resolve to it too.
const makeChain = () => {
  const chain: any = { __result: { data: null, error: null, count: 0 } };
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'not', 'in',
    'gte', 'lte', 'is', 'order',
  ];
  for (const m of methods) chain[m] = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(chain.__result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(chain.__result));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(chain.__result).then(resolve, reject);
  return chain;
};

let chains: Record<string, any> = {};
const seed = (table: string, result: any) => {
  const c = makeChain();
  c.__result = result;
  chains[table] = c;
};

const mockSupabase = {
  from: jest.fn((table: string) => {
    if (!chains[table]) chains[table] = makeChain();
    return chains[table];
  }),
};

describe('ReportsService', () => {
  let service: ReportsService;
  let commissions: { computeCommissionBreakdownForPeriod: jest.Mock };
  let cashRegister: { calculateDailyTotals: jest.Mock };

  const period = {
    startDate: '2026-06-01T00:00:00',
    endDate: '2026-06-30T23:59:59',
  };

  beforeEach(async () => {
    chains = {};
    mockSupabase.from.mockClear();
    mockSupabase.from.mockImplementation((table: string) => {
      if (!chains[table]) chains[table] = makeChain();
      return chains[table];
    });
    commissions = { computeCommissionBreakdownForPeriod: jest.fn().mockResolvedValue([]) };
    cashRegister = { calculateDailyTotals: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: CommissionsService, useValue: commissions },
        { provide: CashRegisterService, useValue: cashRegister },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('getProfessionalReport (H3)', () => {
    it('reports the SAME commission as the Comissões screen (from the shared breakdown), not totalPrice×rate', async () => {
      seed('professionals', {
        data: [{ id: 'prof-A', name: 'Alex', commissionRate: 50, isActive: true }],
        error: null,
      });
      // Avulso revenue = 5000; totalPrice×rate would give 2500. The real commission
      // (pote + products) is 9000 and must win.
      seed('appointments', {
        data: [
          { totalPrice: 5000, status: 'ATTENDED' },
          { totalPrice: 0, status: 'ATTENDED' },
        ],
        count: 2,
        error: null,
      });
      commissions.computeCommissionBreakdownForPeriod.mockResolvedValue([
        {
          professionalId: 'prof-A',
          branchId: null,
          commissionRate: 50,
          amountServices: 2500,
          amountSubscription: 5000,
          amountProducts: 1500,
          amount: 9000,
        },
      ]);

      const result = await service.getProfessionalReport(period);

      expect(commissions.computeCommissionBreakdownForPeriod).toHaveBeenCalledWith(
        period.startDate,
        period.endDate,
      );
      expect(result[0].financial.commission).toBe(9000);
    });

    it('shows commission 0 for a professional with no entry in the breakdown', async () => {
      seed('professionals', {
        data: [{ id: 'prof-B', name: 'Bia', commissionRate: 40, isActive: true }],
        error: null,
      });
      seed('appointments', {
        data: [{ totalPrice: 8000, status: 'ATTENDED' }],
        count: 1,
        error: null,
      });
      commissions.computeCommissionBreakdownForPeriod.mockResolvedValue([]); // prof-B absent

      const result = await service.getProfessionalReport(period);

      expect(result[0].financial.commission).toBe(0);
    });

    it('keeps an INACTIVE professional that had activity in the period (M2)', async () => {
      seed('professionals', {
        data: [
          { id: 'prof-A', name: 'Alex', commissionRate: 50, isActive: true },
          { id: 'prof-gone', name: 'Ex-Barbeiro', commissionRate: 50, isActive: false },
          { id: 'prof-old', name: 'Inativo sem atividade', commissionRate: 50, isActive: false },
        ],
        error: null,
      });
      seed('appointments', { data: [], count: 0, error: null });
      // prof-gone (inativo) teve atendimento no período → aparece no breakdown.
      commissions.computeCommissionBreakdownForPeriod.mockResolvedValue([
        { professionalId: 'prof-gone', branchId: null, commissionRate: 50, amountServices: 0, amountSubscription: 0, amountProducts: 0, amount: 4000 },
      ]);

      const result = await service.getProfessionalReport(period);
      const ids = result.map((r: any) => r.id);

      expect(ids).toContain('prof-A'); // ativo
      expect(ids).toContain('prof-gone'); // inativo COM atividade
      expect(ids).not.toContain('prof-old'); // inativo SEM atividade some
      const gone = result.find((r: any) => r.id === 'prof-gone');
      expect(gone.financial.commission).toBe(4000);
    });
  });

  describe('getServicesReport (H2)', () => {
    it('computes revenue from order_items.unitPrice (covered subscription cut = R$0), not catalog price', async () => {
      seed('services', {
        data: [{ id: 'svc-1', name: 'Corte', price: 4000, duration: 30 }],
        error: null,
      });
      seed('appointments', { data: [{ id: 'appt-1' }, { id: 'appt-2' }], error: null });
      seed('orders', {
        data: [
          {
            appointmentId: 'appt-1',
            items: [
              {
                serviceId: 'svc-1',
                unitPrice: 4000,
                itemType: 'SERVICE',
                service: { id: 'svc-1', name: 'Corte', price: 4000, duration: 30 },
              },
            ],
          },
          {
            appointmentId: 'appt-2',
            items: [
              {
                serviceId: 'svc-1',
                unitPrice: 0, // corte coberto pela assinatura
                itemType: 'SERVICE',
                service: { id: 'svc-1', name: 'Corte', price: 4000, duration: 30 },
              },
            ],
          },
        ],
        error: null,
      });

      const result = await service.getServicesReport(period);
      const corte = result.find((s) => s.id === 'svc-1');

      expect(corte).toBeDefined();
      expect(corte!.count).toBe(2); // two cuts performed
      expect(corte!.revenue).toBe(4000); // only the paid one; covered cut = 0 (not 8000)
    });

    it('keeps a discontinued (inactive) service that had activity in the period', async () => {
      // 'svc-old' is NOT in the active services list, but appears in an order_item.
      seed('services', {
        data: [{ id: 'svc-1', name: 'Corte', price: 4000, duration: 30 }],
        error: null,
      });
      seed('appointments', { data: [{ id: 'appt-1' }], error: null });
      seed('orders', {
        data: [
          {
            appointmentId: 'appt-1',
            items: [
              {
                serviceId: 'svc-old',
                unitPrice: 3000,
                itemType: 'SERVICE',
                service: { id: 'svc-old', name: 'Pézinho (descontinuado)', price: 3500, duration: 10 },
              },
            ],
          },
        ],
        error: null,
      });

      const result = await service.getServicesReport(period);
      const old = result.find((s) => s.id === 'svc-old');

      expect(old).toBeDefined();
      expect(old!.name).toBe('Pézinho (descontinuado)');
      expect(old!.revenue).toBe(3000);
      expect(old!.count).toBe(1);
    });

    it('respects order_items.quantity (count and revenue scale by quantity)', async () => {
      seed('services', {
        data: [{ id: 'svc-1', name: 'Corte', price: 4000, duration: 30 }],
        error: null,
      });
      seed('appointments', { data: [{ id: 'appt-1' }], error: null });
      seed('orders', {
        data: [
          {
            appointmentId: 'appt-1',
            status: 'PAID',
            items: [
              {
                serviceId: 'svc-1',
                unitPrice: 4000, // per-unit
                quantity: 2,
                itemType: 'SERVICE',
                service: { id: 'svc-1', name: 'Corte', price: 4000, duration: 30 },
              },
            ],
          },
        ],
        error: null,
      });

      const result = await service.getServicesReport(period);
      const corte = result.find((s) => s.id === 'svc-1');

      expect(corte!.count).toBe(2);
      expect(corte!.revenue).toBe(8000); // 4000 × 2
    });

    it('excludes CANCELED orders from the services revenue', async () => {
      seed('services', {
        data: [{ id: 'svc-1', name: 'Corte', price: 4000, duration: 30 }],
        error: null,
      });
      seed('appointments', { data: [{ id: 'appt-1' }], error: null });
      seed('orders', { data: [], error: null });

      await service.getServicesReport(period);

      expect(chains['orders'].neq).toHaveBeenCalledWith('status', 'CANCELED');
    });

    it('throws (does not silently report zero) when the orders query fails', async () => {
      seed('services', {
        data: [{ id: 'svc-1', name: 'Corte', price: 4000, duration: 30 }],
        error: null,
      });
      seed('appointments', { data: [{ id: 'appt-1' }], error: null });
      seed('orders', { data: null, error: { message: 'URL too long' } });

      await expect(service.getServicesReport(period)).rejects.toBeDefined();
    });
  });

  describe('getCashRegisterReport (M2)', () => {
    it('recomputes OPEN registers in real time instead of counting their null totals as 0', async () => {
      seed('cash_registers', {
        data: [
          {
            id: 'r-closed',
            date: '2026-06-01',
            isOpen: false,
            totalCash: 5000,
            totalPix: 0,
            totalCard: 0,
            totalRevenue: 5000,
            discrepancy: 0,
          },
          {
            id: 'r-open',
            date: '2026-06-09',
            isOpen: true,
            totalCash: null,
            totalPix: null,
            totalCard: null,
            totalRevenue: null,
            discrepancy: null,
          },
        ],
        error: null,
      });
      cashRegister.calculateDailyTotals.mockResolvedValue({
        cash: 3000,
        pix: 0,
        card: 0,
        total: 3000,
      });

      const report = await service.getCashRegisterReport(period);

      // 5000 (closed, persisted) + 3000 (open, recomputed) — not 5000+0.
      expect(report.summary.totalRevenue).toBe(8000);
      expect(cashRegister.calculateDailyTotals).toHaveBeenCalledWith('2026-06-09');
      const open = report.registers.find((r: any) => r.id === 'r-open');
      expect(open.totalRevenue).toBe(3000);
    });
  });
});
