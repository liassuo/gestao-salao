import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
  chain.or = jest.fn().mockReturnValue(chain);
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
  let debtsService: { applyDeductionToCommission: jest.Mock; reverseDeductionsForCommissions: jest.Mock };

  beforeEach(async () => {
    chains = {};
    mockSupabase.from.mockClear();
    mockSupabase.from.mockImplementation((table: string) => {
      if (!chains[table]) chains[table] = mockChain();
      return chains[table];
    });

    debtsService = {
      applyDeductionToCommission: jest.fn().mockResolvedValue(0),
      reverseDeductionsForCommissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ProfessionalDebtsService, useValue: debtsService },
      ],
    }).compile();

    service = module.get<CommissionsService>(CommissionsService);
  });

  describe('remove', () => {
    it('estorna as deduções de débito ANTES de apagar uma comissão PENDING', async () => {
      chains['commissions'] = mockChain();
      chains['commissions'].single.mockResolvedValue({
        data: { id: 'com-1', status: 'PENDING' },
        error: null,
      });

      await service.remove('com-1');

      expect(debtsService.reverseDeductionsForCommissions).toHaveBeenCalledWith(['com-1']);
      expect(chains['commissions'].delete).toHaveBeenCalled();
      // ordem: estorno primeiro, delete depois (a FK anula o vínculo no delete)
      const reverseOrder = debtsService.reverseDeductionsForCommissions.mock.invocationCallOrder[0];
      const deleteOrder = chains['commissions'].delete.mock.invocationCallOrder[0];
      expect(reverseOrder).toBeLessThan(deleteOrder);
    });

    it('bloqueia excluir comissão PAID (sem estornar nem apagar)', async () => {
      chains['commissions'] = mockChain();
      chains['commissions'].single.mockResolvedValue({
        data: { id: 'com-1', status: 'PAID' },
        error: null,
      });

      await expect(service.remove('com-1')).rejects.toThrow(BadRequestException);
      expect(debtsService.reverseDeductionsForCommissions).not.toHaveBeenCalled();
      expect(chains['commissions'].delete).not.toHaveBeenCalled();
    });
  });

  describe('unmarkAsPaid', () => {
    it('volta uma comissão PAID para PENDING e limpa paidAt', async () => {
      chains['commissions'] = mockChain();
      chains['commissions'].single
        .mockResolvedValueOnce({ data: { id: 'com-1', status: 'PAID' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'com-1', status: 'PENDING', paidAt: null }, error: null });

      const result = await service.unmarkAsPaid('com-1');

      expect(chains['commissions'].update).toHaveBeenCalledWith({ status: 'PENDING', paidAt: null });
      expect(result.status).toBe('PENDING');
    });

    it('rejeita desfazer pagamento de comissão que não está PAID', async () => {
      chains['commissions'] = mockChain();
      chains['commissions'].single.mockResolvedValue({
        data: { id: 'com-1', status: 'PENDING' },
        error: null,
      });

      await expect(service.unmarkAsPaid('com-1')).rejects.toThrow(BadRequestException);
      expect(chains['commissions'].update).not.toHaveBeenCalled();
    });
  });

  describe('computeCommissionBreakdownForPeriod', () => {
    // Helper: subscription order_items now come from a separate orders(.in) query.
    const seedSubscriptionOrders = (rows: any[]) => {
      chains['orders'].in.mockResolvedValue({ data: rows, error: null });
    };

    it('combines avulso×rate, subscription pote (50%/fichas) and products×rate into one breakdown per professional', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        // 1) regular (avulso) query terminal — serviço avulso vem dos order_items
        //    SERVICE da comanda (não de appointment.totalPrice, que mistura produto).
        .mockResolvedValueOnce({
          data: [
            {
              professionalId: 'prof-A',
              orders: [
                { status: 'PAID', order_items: [{ unitPrice: 5000, quantity: 1, itemType: 'SERVICE' }] },
              ],
            },
          ],
          error: null,
        })
        // 2) subscription appointment ids terminal
        .mockResolvedValueOnce({ data: [{ id: 'appt-s', usedSubscriptionCut: true, status: 'ATTENDED' }], error: null });

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
        .mockResolvedValueOnce({ data: [{ id: 'appt-mix', usedSubscriptionCut: true, status: 'ATTENDED' }], error: null });

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

    it('does NOT double-count a product that sits on a regular appointment comanda (H-A)', async () => {
      // Bug: o serviço avulso somava appointment.totalPrice (que JÁ inclui o produto,
      // pois orders.addItem faz appointment.totalPrice = order.totalAmount) no bucket
      // de serviços, e o mesmo produto entrava de novo no bucket de produtos → produto
      // contado 2×. Correção: serviço avulso vem só dos order_items SERVICE.
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        // 1) regular (avulso): corte 5000 (SERVICE) + pomada 3000 (PRODUCT) na comanda.
        .mockResolvedValueOnce({
          data: [
            {
              professionalId: 'prof-A',
              totalPrice: 8000, // 5000 + 3000 — NÃO deve ser usado para serviço
              orders: [
                {
                  status: 'PAID',
                  order_items: [
                    { unitPrice: 5000, quantity: 1, itemType: 'SERVICE' },
                    { unitPrice: 3000, quantity: 1, itemType: 'PRODUCT' },
                  ],
                },
              ],
            },
          ],
          error: null,
        })
        // 2) attended (atribui o produto): o mesmo agendamento avulso
        .mockResolvedValueOnce({
          data: [{ id: 'appt-r', usedSubscriptionCut: false, status: 'ATTENDED' }],
          error: null,
        });

      chains['orders'] = mockChain();
      // balcão: nenhum
      chains['orders'].lte.mockResolvedValue({ data: [], error: null });
      // comanda do agendamento (linked, PAID): produto 3000 → bucket de produtos (1×)
      chains['orders'].in.mockResolvedValue({
        data: [{ professionalId: 'prof-A', items: [{ unitPrice: 3000, quantity: 1, itemType: 'PRODUCT' }] }],
        error: null,
      });

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
      expect(a.amountServices).toBe(2500); // 5000 (SÓ o corte) × 50%
      expect(a.amountProducts).toBe(1500); // 3000 × 50% — contado UMA vez
      expect(a.amount).toBe(4000); // não 5500 (produto contado 2×)
    });

    it('keeps service commission for a LEGACY avulso appointment with no backing order (pre-comanda automática)', async () => {
      // Agendamentos atendidos antes da comanda automática (~2026-04-01) não têm
      // order/order_items. A comissão de serviço deve cair no fallback de totalPrice —
      // senão períodos históricos mostram comissão de serviço 0 (regressão).
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        // regular (avulso) legado: totalPrice setado, orders vazio (PostgREST devolve [])
        .mockResolvedValueOnce({
          data: [{ professionalId: 'prof-A', totalPrice: 6000, orders: [] }],
          error: null,
        })
        // attended: nenhum (sem produtos)
        .mockResolvedValueOnce({ data: [], error: null });

      chains['orders'] = mockChain();
      chains['orders'].lte.mockResolvedValue({ data: [], error: null });
      chains['orders'].in.mockResolvedValue({ data: [], error: null });

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({
        data: { id: 'prof-A', commissionRate: 50, branchId: null },
        error: null,
      });

      const result = await service.computeCommissionBreakdownForPeriod(
        '2026-02-01T00:00:00',
        '2026-02-28T23:59:59',
      );

      expect(result).toHaveLength(1);
      expect(result[0].amountServices).toBe(3000); // 6000 × 50% via fallback totalPrice
    });

    it('uses subscriptionRevenueOverride for the pote when provided', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [{ id: 'appt-s', usedSubscriptionCut: true, status: 'ATTENDED' }], error: null });
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

    it('attributes an appointment-linked product by scheduledAt and counts it even when PAID-but-not-yet-ATTENDED (M3)', async () => {
      chains['appointments'] = mockChain();
      chains['appointments'].lte
        .mockResolvedValueOnce({ data: [], error: null }) // no avulso services
        // appointment is PAID but still SCHEDULED (orders.pay sets isPaid without ATTENDED).
        // The product attribution query (status ATTENDED OR isPaid) must still return it.
        .mockResolvedValueOnce({
          data: [{ id: 'appt-prod', usedSubscriptionCut: false, status: 'SCHEDULED' }],
          error: null,
        });

      chains['orders'] = mockChain();
      chains['orders'].lte.mockResolvedValue({ data: [], error: null }); // no balcão sale
      // product is in an APPOINTMENT comanda → fetched via attended ids (.in), so it
      // counts in the period of the ATTENDANCE/sale, not the booking date.
      chains['orders'].in.mockResolvedValue({
        data: [
          { professionalId: 'prof-A', items: [{ unitPrice: 2000, quantity: 1, itemType: 'PRODUCT' }] },
        ],
        error: null,
      });

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
      expect(result[0].amountProducts).toBe(1000); // 2000 × 50%
      // product attribution must include paid (not only ATTENDED) appointments
      expect(chains['appointments'].or).toHaveBeenCalledWith('status.eq.ATTENDED,isPaid.eq.true');
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
