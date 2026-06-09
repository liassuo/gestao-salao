import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CommissionsService } from '../commissions/commissions.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { AsaasService } from '../asaas/asaas.service';

// Thenable mock chain: `await chain` (queries that don't end in .single/.order)
// resolve to chain.__result; .single/.maybeSingle resolve to it too.
const makeChain = () => {
  const chain: any = { __result: { data: null, error: null, count: 0 } };
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'not', 'in',
    'gte', 'lte', 'is', 'order', 'limit',
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
  let asaas: { configured: boolean; getCharge: jest.Mock };

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
    asaas = { configured: true, getCharge: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: CommissionsService, useValue: commissions },
        { provide: CashRegisterService, useValue: cashRegister },
        { provide: AsaasService, useValue: asaas },
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

  describe('getAsaasReconciliation', () => {
    it('compara o bruto cobrado (payments.amount) com value/netValue do Asaas e marca taxa + divergência', async () => {
      seed('payments', {
        data: [
          { id: 'p1', asaasPaymentId: 'ch_ok', amount: 5000, method: 'PIX', billingType: 'PIX', asaasStatus: 'RECEIVED', paidAt: '2026-06-10T10:00:00', clientId: 'c1' },
          { id: 'p2', asaasPaymentId: 'ch_div', amount: 3000, method: 'CARD', billingType: 'CREDIT_CARD', asaasStatus: 'CONFIRMED', paidAt: '2026-06-11T10:00:00', clientId: 'c2' },
          { id: 'p3', asaasPaymentId: 'ch_err', amount: 2000, method: 'PIX', billingType: 'PIX', asaasStatus: 'RECEIVED', paidAt: '2026-06-12T10:00:00', clientId: 'c3' },
        ],
        error: null,
      });
      asaas.getCharge.mockImplementation(async (id: string) => {
        if (id === 'ch_ok') return { id, value: 50.0, netValue: 48.01, status: 'RECEIVED' }; // taxa R$1,99
        if (id === 'ch_div') return { id, value: 25.0, netValue: 24.0, status: 'CONFIRMED' }; // app cobrou R$30, Asaas R$25
        throw new Error('not found'); // ch_err
      });

      const report = await service.getAsaasReconciliation(period);

      expect(report.configured).toBe(true);
      expect(report.items).toHaveLength(3);

      const ok = report.items.find((i: any) => i.asaasPaymentId === 'ch_ok');
      expect(ok.appAmountCentavos).toBe(5000);
      expect(ok.asaasValueCentavos).toBe(5000);
      expect(ok.asaasNetCentavos).toBe(4801);
      expect(ok.feeCentavos).toBe(199); // R$1,99 de taxa
      expect(ok.divergent).toBe(false);
      expect(ok.status).toBe('OK_COM_TAXA');

      const div = report.items.find((i: any) => i.asaasPaymentId === 'ch_div');
      expect(div.appAmountCentavos).toBe(3000);
      expect(div.asaasValueCentavos).toBe(2500);
      expect(div.divergent).toBe(true); // bruto do app != value do Asaas
      expect(div.status).toBe('VALOR_DIVERGENTE');

      const err = report.items.find((i: any) => i.asaasPaymentId === 'ch_err');
      expect(err.error).toBe(true);
      expect(err.asaasValueCentavos).toBeNull();
      expect(err.status).toBe('ERRO_CONSULTA');

      expect(report.summary.count).toBe(3);
      expect(report.summary.divergentCount).toBe(1);
      expect(report.summary.errorCount).toBe(1);
      // taxa somada de TODas as cobranças consultadas: ch_ok (199) + ch_div (100) = 299
      expect(report.summary.totalFeeCentavos).toBe(299);
      expect(report.summary.totalAppAmountCentavos).toBe(10000); // 5000+3000+2000
      expect(report.summary.totalAsaasNetCentavos).toBe(4801 + 2400); // só os consultados com sucesso
    });

    it('retorna configured=false sem chamar o Asaas quando o gateway não está configurado', async () => {
      asaas.configured = false;
      const report = await service.getAsaasReconciliation(period);
      expect(report.configured).toBe(false);
      expect(asaas.getCharge).not.toHaveBeenCalled();
    });

    it('marca cobrança ESTORNADA como ESTORNADO e NÃO soma sua taxa fantasma (M1)', async () => {
      // Estorno: o Asaas mantém value (bruto) mas zera/reduz netValue. Sem tratar,
      // value−net viraria uma "taxa" enorme e a linha apareceria como OK_COM_TAXA.
      seed('payments', {
        data: [
          { id: 'p4', asaasPaymentId: 'ch_ref', amount: 5000, method: 'PIX', billingType: 'PIX', asaasStatus: 'REFUNDED', paidAt: '2026-06-13T10:00:00', clientId: 'c4' },
        ],
        error: null,
      });
      asaas.getCharge.mockResolvedValue({ id: 'ch_ref', value: 50.0, netValue: 0, status: 'REFUNDED' });

      const report = await service.getAsaasReconciliation(period);
      const row = report.items.find((i: any) => i.asaasPaymentId === 'ch_ref');

      expect(row.status).toBe('ESTORNADO');
      expect(report.summary.refundedCount).toBe(1);
      expect(report.summary.totalFeeCentavos).toBe(0); // não conta a taxa fantasma de R$50
    });

    it('marca cobrança liquidada sem netValue ainda disponível como AGUARDANDO_LIQUIDO (L3)', async () => {
      seed('payments', {
        data: [
          { id: 'p5', asaasPaymentId: 'ch_pend', amount: 4000, method: 'PIX', billingType: 'PIX', asaasStatus: 'CONFIRMED', paidAt: '2026-06-14T10:00:00', clientId: 'c5' },
        ],
        error: null,
      });
      asaas.getCharge.mockResolvedValue({ id: 'ch_pend', value: 40.0, status: 'CONFIRMED' }); // sem netValue

      const report = await service.getAsaasReconciliation(period);
      const row = report.items.find((i: any) => i.asaasPaymentId === 'ch_pend');

      expect(row.status).toBe('AGUARDANDO_LIQUIDO');
      expect(row.feeCentavos).toBeNull(); // não inventa taxa 0
      expect(report.summary.totalFeeCentavos).toBe(0);
    });

    it('limita a quantidade de cobranças consultadas e sinaliza truncated (M2)', async () => {
      seed('payments', {
        data: [
          { id: 'p6', asaasPaymentId: 'ch_a', amount: 1000, method: 'PIX', billingType: 'PIX', asaasStatus: 'RECEIVED', paidAt: '2026-06-15T10:00:00', clientId: 'c6' },
        ],
        error: null,
      });
      asaas.getCharge.mockResolvedValue({ id: 'ch_a', value: 10, netValue: 9.5, status: 'RECEIVED' });

      const report = await service.getAsaasReconciliation(period);

      // cap aplicado na query (evita centenas de getCharge num request só)
      expect(chains['payments'].limit).toHaveBeenCalled();
      expect(report.truncated).toBe(false);
    });
  });
});
