/**
 * Testa o filtro de RECEITA do helper compartilhado. Esta é a fonte única de
 * verdade usada por caixa, dashboard, relatórios e comissões — um pagamento
 * estornado/cancelado não pode contar como receita em NENHUMA dessas telas
 * (foi a "receita fantasma" relatada: "só retornei o PIX e entrou no caixa").
 */
import {
  isRevenuePayment,
  fetchPaymentsByBusinessDate,
  NON_REVENUE_ASAAS_STATUSES,
} from './business-date.helper';

describe('isRevenuePayment', () => {
  it('pagamento manual (sem asaasStatus) sempre conta como receita', () => {
    expect(isRevenuePayment({})).toBe(true);
    expect(isRevenuePayment({ asaasStatus: null })).toBe(true);
  });

  it('pagamento Asaas recebido/confirmado conta como receita', () => {
    expect(isRevenuePayment({ asaasStatus: 'RECEIVED' })).toBe(true);
    expect(isRevenuePayment({ asaasStatus: 'CONFIRMED' })).toBe(true);
  });

  it('estorno/cancelamento/chargeback NÃO conta como receita', () => {
    for (const s of NON_REVENUE_ASAAS_STATUSES) {
      expect(isRevenuePayment({ asaasStatus: s })).toBe(false);
    }
  });
});

describe('fetchPaymentsByBusinessDate (filtro de estorno)', () => {
  // Mock mínimo do client Supabase: .from().select().gte()/.lte()/.is() encadeáveis
  // e thenable resolvendo para as linhas que casam a janela.
  function mockSupabase(rows: any[]) {
    return {
      from: () => {
        let isNullBusiness = false;
        const chain: any = {
          select: () => chain,
          gte: () => chain,
          lte: () => chain,
          is: (_col: string, val: any) => {
            if (val === null) isNullBusiness = true;
            return chain;
          },
          then: (resolve: any) => {
            // Query (a) businessDate não-nulo; query (b) legado businessDate nulo.
            const data = isNullBusiness
              ? rows.filter((r) => r.businessDate == null && r.paidAt != null)
              : rows.filter((r) => r.businessDate != null);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return chain;
      },
    };
  }

  const rows = [
    { amount: 100, asaasStatus: 'RECEIVED', businessDate: '2026-05-07T00:00:00' },
    { amount: 200, asaasStatus: 'REFUNDED', businessDate: '2026-05-07T00:00:00' },
    { amount: 50, asaasStatus: null, businessDate: null, paidAt: '2026-05-07T10:00:00' }, // legado manual
  ];

  it('por padrão remove pagamentos estornados', async () => {
    const out = await fetchPaymentsByBusinessDate(
      mockSupabase(rows) as any,
      'amount',
      '2026-05-07T00:00:00',
      '2026-05-07T23:59:59',
    );
    const total = out.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(150); // 100 + 50; o estorno de 200 saiu
    expect(out.some((p) => p.asaasStatus === 'REFUNDED')).toBe(false);
  });

  it('includeNonRevenue=true devolve a lista bruta (auditoria)', async () => {
    const out = await fetchPaymentsByBusinessDate(
      mockSupabase(rows) as any,
      'amount',
      '2026-05-07T00:00:00',
      '2026-05-07T23:59:59',
      { includeNonRevenue: true },
    );
    const total = out.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(350); // inclui o estorno
  });
});
