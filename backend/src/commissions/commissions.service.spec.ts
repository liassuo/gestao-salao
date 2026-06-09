import { Test, TestingModule } from '@nestjs/testing';
import { CommissionsService } from './commissions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ProfessionalDebtsService } from '../professional-debts/professional-debts.service';

const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.neq = jest.fn().mockReturnValue(chain);
  chain.not = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.is = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
};

let chains: Record<string, any> = {};
const mockSupabase = {
  from: jest.fn().mockImplementation((table: string) => {
    if (!chains[table]) chains[table] = mockChain();
    return chains[table];
  }),
};

describe('CommissionsService', () => {
  let service: CommissionsService;

  beforeEach(async () => {
    chains = {};
    mockSupabase.from.mockClear();
    mockSupabase.from.mockImplementation((table: string) => {
      if (!chains[table]) chains[table] = mockChain();
      return chains[table];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: SupabaseService, useValue: mockSupabase },
        {
          provide: ProfessionalDebtsService,
          useValue: {
            applyDeductionToCommission: jest.fn().mockResolvedValue(0),
            reverseDeductionsForCommissions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommissionsService>(CommissionsService);
  });

  describe('computeCommissionBreakdownForPeriod', () => {
    // Helper: subscription order_items now come from a separate orders(.in) query.
    const seedSubscriptionOrders = (rows: any[]) => {
      chains['orders'].in.mockResolvedValue({ data: rows, error: null });
    };

    it('combines avulso×rate, subscription pote (50%/fichas) and products×rate into one breakdown per professional', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        // 1) regular (avulso) query terminal
        .mockResolvedValueOnce({
          data: [{ professionalId: 'prof-A', totalPrice: 5000 }],
          error: null,
        })
        // 2) subscription appointment ids terminal
        .mockResolvedValueOnce({ data: [{ id: 'appt-s' }], error: null });

      chains['orders'] = mockChain();
      // 3) products (orders PAID) terminal .lte
      chains['orders'].lte.mockResolvedValue({
        data: [
          {
            professionalId: 'prof-A',
            items: [{ unitPrice: 3000, quantity: 1, itemType: 'PRODUCT' }],
          },
        ],
        error: null,
      });
      // 4) subscription order_items terminal .in: 1 covered service = 1 ficha
      seedSubscriptionOrders([
        {
          professionalId: 'prof-A',
          items: [
            { itemType: 'SERVICE', consumedSubscriptionCut: true, unitPrice: 0, quantity: 1, service: { fichas: 1, duration: 30 } },
          ],
        },
      ]);

      // subscription revenue for the pote = 10000 (computeSubscriptionRevenue)
      chains['payments'] = mockChain();
      chains['payments'].lte.mockResolvedValue({
        data: [{ amount: 10000, asaasStatus: null }],
        error: null,
      });

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-A', commissionRate: 50, branchId: 'branch-1' },
        error: null,
      });

      const result = await service.computeCommissionBreakdownForPeriod(
        '2026-06-01T00:00:00',
        '2026-06-30T23:59:59',
      );

      expect(result).toHaveLength(1);
      const a = result[0];
      expect(a.professionalId).toBe('prof-A');
      expect(a.amountServices).toBe(2500); // 5000 * 50%
      expect(a.amountSubscription).toBe(5000); // 50% of 10000, all fichas are prof-A
      expect(a.amountProducts).toBe(1500); // 3000 * 50%
      expect(a.amount).toBe(9000);
    });

    it('counts a PAID EXTRA service inside a subscription appointment as avulso (×rate), not pote — only the covered item makes fichas (M4)', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        .mockResolvedValueOnce({ data: [], error: null }) // no pure-avulso
        .mockResolvedValueOnce({ data: [{ id: 'appt-mix' }], error: null });

      chains['orders'] = mockChain();
      chains['orders'].lte.mockResolvedValue({ data: [], error: null }); // no products
      seedSubscriptionOrders([
        {
          professionalId: 'prof-A',
          items: [
            // coberto pelo plano (consumiu corte): vira ficha do pote, preço 0
            { itemType: 'SERVICE', consumedSubscriptionCut: true, unitPrice: 0, quantity: 1, service: { fichas: 1, duration: 30 } },
            // EXTRA pago no mesmo atendimento: deve render avulso × taxa, NÃO pote
            { itemType: 'SERVICE', consumedSubscriptionCut: false, unitPrice: 5000, quantity: 1, service: { fichas: 1, duration: 20 } },
          ],
        },
      ]);

      chains['payments'] = mockChain();
      chains['payments'].lte.mockResolvedValue({ data: [{ amount: 10000, asaasStatus: null }], error: null });

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-A', commissionRate: 50, branchId: null },
        error: null,
      });

      const result = await service.computeCommissionBreakdownForPeriod(
        '2026-06-01T00:00:00',
        '2026-06-30T23:59:59',
      );

      expect(result).toHaveLength(1);
      const a = result[0];
      // pote: SÓ 1 ficha (a do coberto; o extra não gera ficha) → 50% de 10000 = 5000
      expect(a.amountSubscription).toBe(5000);
      // extra pago 5000 → 50% = 2500 (antes ia pro pote e não rendia taxa)
      expect(a.amountServices).toBe(2500);
      expect(a.amount).toBe(7500);
    });

    it('uses subscriptionRevenueOverride for the pote when provided', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [{ id: 'appt-s' }], error: null });
      chains['orders'] = mockChain();
      chains['orders'].lte.mockResolvedValue({ data: [], error: null });
      seedSubscriptionOrders([
        {
          professionalId: 'prof-A',
          items: [
            { itemType: 'SERVICE', consumedSubscriptionCut: true, unitPrice: 0, quantity: 1, service: { fichas: 2, duration: 30 } },
          ],
        },
      ]);
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-A', commissionRate: 40, branchId: null },
        error: null,
      });

      const result = await service.computeCommissionBreakdownForPeriod(
        '2026-06-01T00:00:00',
        '2026-06-30T23:59:59',
        20000, // override: pote base = 20000 → barber pool 50% = 10000, single prof gets all
      );

      expect(result).toHaveLength(1);
      expect(result[0].amountSubscription).toBe(10000);
      // payments table never queried because override short-circuits computeSubscriptionRevenue
      expect(chains['payments']).toBeUndefined();
    });

    it('returns an empty array when there is no attendance or sale in the period', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });
      chains['orders'] = mockChain();
      chains['orders'].lte.mockResolvedValue({ data: [], error: null });

      const result = await service.computeCommissionBreakdownForPeriod(
        '2026-06-01T00:00:00',
        '2026-06-30T23:59:59',
      );

      expect(result).toEqual([]);
    });
  });
});
