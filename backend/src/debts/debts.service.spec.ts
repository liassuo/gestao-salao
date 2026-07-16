/**
 * Regressão dos dois furos do pagamento de dívida.
 *
 * 1. ESPELHO DEBT_PAYMENT (caso Paulo Sergio, 16/07/2026): o insert do payment
 *    ia SEM registeredBy (NOT NULL) e o erro não era checado — falhava em
 *    silêncio desde 03/2026. Sem o espelho, o webhook não achava o pagamento e
 *    a dívida ficava aberta com a assinatura suspensa mesmo com o PIX pago.
 *
 * 2. QUITAÇÃO NO BALCÃO (settleDebt): quitava a dívida, lançava o caixa e
 *    limpava hasDebts, mas deixava a assinatura SUSPENDED — cliente ficava
 *    "sem-dívida-e-encerrado" (irrecuperável: a dívida era a prova do débito) e
 *    voltava a ser cobrado no corte. Precisa reativar E vincular o pagamento à
 *    assinatura (senão volta ACTIVE com "ciclo não pago" — mesmo sintoma).
 */
import { DebtsService } from './debts.service';

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

// ============================================================
// Mock stateful do Supabase (mesmo padrão dos specs de webhook/subscriptions)
// ============================================================
function createStatefulSupabase(initial: Tables = {}) {
  const tables: Tables = {};
  for (const [k, v] of Object.entries(initial)) tables[k] = v.map((r) => ({ ...r }));

  function applyFilters(rows: Row[], filters: any[]): Row[] {
    return rows.filter((r) =>
      filters.every(([op, col, val]) => {
        if (op === 'eq') return r[col] === val;
        if (op === 'is') return r[col] === val;
        if (op === 'not-is') return r[col] !== val;
        if (op === 'in') return val.includes(r[col]);
        if (op === 'ilike') {
          const target = String(val).replace(/^%/, '').replace(/%$/, '').toLowerCase();
          return String(r[col] ?? '').toLowerCase().includes(target);
        }
        return true;
      }),
    );
  }

  function builder(table: string) {
    if (!tables[table]) tables[table] = [];
    const filters: any[] = [];
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: any = null;
    let updatePayload: any = null;

    let headCount = false;

    const chain: any = {
      // .select('id', { count: 'exact', head: true }) → resposta traz `count`
      // (usado por updateClientHasDebtsFlag) e não `data`.
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) headCount = true;
        return chain;
      },
      insert: (data: any) => {
        mode = 'insert';
        payload = Array.isArray(data) ? data : [data];
        return chain;
      },
      update: (data: any) => {
        mode = 'update';
        updatePayload = data;
        return chain;
      },
      eq: (col: string, val: any) => (filters.push(['eq', col, val]), chain),
      is: (col: string, val: any) => (filters.push(['is', col, val]), chain),
      not: (col: string, _: string, val: any) => (filters.push(['not-is', col, val]), chain),
      in: (col: string, vals: any[]) => (filters.push(['in', col, vals]), chain),
      ilike: (col: string, val: string) => (filters.push(['ilike', col, val]), chain),
      order: () => chain,
      limit: () => chain,
      single: async () => {
        if (mode === 'insert' || mode === 'update') {
          const res = runTerminal();
          return { data: res.data, error: res.data ? null : { code: 'PGRST116', message: 'No rows' } };
        }
        const rows = applyFilters(tables[table], filters);
        if (rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'No/many rows' } };
        return { data: { ...rows[0] }, error: null };
      },
      maybeSingle: async () => {
        if (mode === 'insert' || mode === 'update') {
          const res = runTerminal();
          return { data: res.data, error: null };
        }
        const rows = applyFilters(tables[table], filters);
        return { data: rows[0] ? { ...rows[0] } : null, error: null };
      },
      then: (resolve: any) => Promise.resolve(runTerminal()).then(resolve),
    };

    function runTerminal(): { data: any; error: any; count?: number } {
      if (mode === 'insert') {
        for (const row of payload) tables[table].push({ ...row });
        return { data: payload[0], error: null };
      }
      if (mode === 'update') {
        const matched = applyFilters(tables[table], filters);
        for (const row of matched) Object.assign(row, updatePayload);
        return { data: matched[0] ? { ...matched[0] } : null, error: null };
      }
      if (mode === 'delete') {
        tables[table] = tables[table].filter((r) => !applyFilters([r], filters).length);
        return { data: null, error: null };
      }
      const rows = applyFilters(tables[table], filters);
      if (headCount) return { data: null, error: null, count: rows.length };
      return { data: rows.map((r) => ({ ...r })), error: null };
    }

    return chain;
  }

  return { from: (table: string) => builder(table), _state: tables };
}

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function baseTables(overrides: Partial<Tables> = {}): Tables {
  return {
    users: [{ id: 'admin-1', role: 'ADMIN' }],
    clients: [{ id: 'client-1', name: 'Paulo', hasDebts: true }],
    client_subscriptions: [
      {
        id: 'sub-1',
        clientId: 'client-1',
        status: 'SUSPENDED',
        endDate: YESTERDAY, // venceu ontem → pagamento hoje está na carência
        startDate: '2026-05-13T13:31:32.756',
        createdAt: '2026-05-13T13:31:32.756',
        cutsUsedThisMonth: 8,
      },
    ],
    debts: [
      {
        id: 'debt-1',
        clientId: 'client-1',
        amount: 14000,
        remainingBalance: 14000,
        isSettled: false,
        description: 'Cobrança não paga — Plano Premium (PIX) [sub:11111111-1111-4111-8111-111111111111:cycle:2026-07-15]',
      },
    ],
    payments: [],
    cash_registers: [{ id: 'caixa-1', isOpen: true }],
    ...overrides,
  };
}

function buildService(tables: Tables, asaasOverrides: Record<string, any> = {}) {
  const sb = createStatefulSupabase(tables);
  const asaas = {
    configured: true,
    cancelCharge: jest.fn().mockResolvedValue({ deleted: true }),
    createCharge: jest.fn().mockResolvedValue({ id: 'asaas_charge_1', status: 'PENDING' }),
    createCustomer: jest.fn(),
    centavosToReais: (v: number) => v / 100,
    getPixQrCode: jest.fn().mockResolvedValue({
      encodedImage: 'img',
      payload: 'copia-e-cola',
      expirationDate: '2026-07-17',
    }),
    ...asaasOverrides,
  };
  const service = new DebtsService(sb as any, asaas as any);
  return { service, state: (sb as any)._state as Tables, asaas };
}

// ============================================================
// 1. Espelho DEBT_PAYMENT
// ============================================================
describe('DebtsService — createPixChargeForDebts (espelho DEBT_PAYMENT)', () => {
  it('cria o espelho com registeredBy do admin-sistema e notes=DEBT_PAYMENT', async () => {
    const { service, state } = buildService(
      baseTables({ clients: [{ id: 'client-1', name: 'Paulo', hasDebts: true, asaasCustomerId: 'cus_1' }] }),
    );

    const result = await service.createPixChargeForDebts('client-1');

    expect(result.totalAmount).toBe(14000);
    expect(result.pixData?.payload).toBe('copia-e-cola');
    const mirror = state.payments.find((p) => p.notes === 'DEBT_PAYMENT');
    expect(mirror).toBeTruthy();
    expect(mirror!.registeredBy).toBe('admin-1');
    expect(mirror!.asaasPaymentId).toBe('asaas_charge_1');
    expect(mirror!.clientId).toBe('client-1');
    expect(mirror!.amount).toBe(14000);
  });
});

// ============================================================
// 2. Quitação no balcão (settleDebt) reativa a assinatura
// ============================================================
describe('DebtsService — settleDebt de mensalidade reativa a assinatura (balcão)', () => {
  const TAGGED = 'Cobrança não paga — Plano Premium (PIX) [sub:sub-1:cycle:2026-07-15]';

  function taggedTables(overrides: Partial<Tables> = {}): Tables {
    const t = baseTables(overrides);
    // tag apontando para a assinatura real do fixture
    t.debts[0].description = TAGGED;
    return t;
  }

  it('quita, vincula o pagamento à assinatura, REATIVA com dia-âncora e cancela o link Asaas pendente', async () => {
    const { service, state, asaas } = buildService(
      taggedTables({
        payments: [
          // link de renovação gerado no Asaas e nunca pago (caso Renato dias):
          // pagar no balcão precisa cancelá-lo para o cliente não pagar 2x.
          {
            id: 'pay-link',
            subscriptionId: 'sub-1',
            asaasPaymentId: 'pay_link_orfao',
            asaasStatus: 'PENDING',
            paidAt: null,
          },
        ],
      }),
    );

    await service.settleDebt('debt-1', 'CASH');

    // dívida quitada e flag limpa
    expect(state.debts[0].isSettled).toBe(true);
    expect(state.debts[0].remainingBalance).toBe(0);
    expect(state.clients[0].hasDebts).toBe(false);

    // pagamento no caixa VINCULADO à assinatura (senão fica "ciclo não pago")
    const pay = state.payments.find((p) => p.notes?.startsWith('Quitação de dívida'));
    expect(pay).toBeTruthy();
    expect(pay!.subscriptionId).toBe('sub-1');
    expect(pay!.amount).toBe(14000);
    expect(pay!.method).toBe('CASH');

    // assinatura reativada com o dia do vencimento preservado (dia-âncora)
    const sub = state.client_subscriptions[0];
    expect(sub.status).toBe('ACTIVE');
    expect(sub.cutsUsedThisMonth).toBe(0);
    expect(new Date(sub.endDate).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(sub.endDate).getUTCDate()).toBe(new Date(YESTERDAY).getUTCDate());

    // link órfão cancelado no Asaas + espelho local marcado
    expect(asaas.cancelCharge).toHaveBeenCalledWith('pay_link_orfao');
    expect(state.payments.find((p) => p.id === 'pay-link')!.asaasStatus).toBe('CANCELED');
  });

  it('deve 2 mensalidades e paga 1: NÃO reativa (anti-mês-grátis)', async () => {
    const tables = taggedTables();
    tables.debts.push({
      id: 'debt-2',
      clientId: 'client-1',
      amount: 14000,
      remainingBalance: 14000,
      isSettled: false,
      description: 'Cobrança não paga — Plano Premium (PIX) [sub:sub-1:cycle:2026-06-15]',
    });
    const { service, state } = buildService(tables);

    await service.settleDebt('debt-1', 'CASH');

    expect(state.debts[0].isSettled).toBe(true);
    expect(state.debts[1].isSettled).toBe(false);
    expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
    expect(state.clients[0].hasDebts).toBe(true);
  });

  it('dívida avulsa (comanda): quita mas NÃO reativa assinatura nem vincula pagamento', async () => {
    const tables = baseTables();
    tables.debts[0].description = 'Comanda em aberto — 10/07';
    const { service, state, asaas } = buildService(tables);

    await service.settleDebt('debt-1', 'CASH');

    expect(state.debts[0].isSettled).toBe(true);
    expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
    const pay = state.payments.find((p) => p.notes?.startsWith('Quitação de dívida'));
    expect(pay!.subscriptionId).toBeUndefined();
    expect(asaas.cancelCharge).not.toHaveBeenCalled();
  });

  it('dívida LEGADO sem tag [sub:]: reativa quando o cliente tem exatamente UMA assinatura suspensa', async () => {
    const tables = baseTables();
    tables.debts[0].description = 'Cobrança não paga — Plano Premium (PIX)';
    const { service, state } = buildService(tables);

    await service.settleDebt('debt-1', 'PIX');

    expect(state.client_subscriptions[0].status).toBe('ACTIVE');
    expect(state.payments.find((p) => p.notes?.startsWith('Quitação de dívida'))!.subscriptionId).toBe('sub-1');
  });

  it('dívida LEGADO sem tag com DUAS assinaturas suspensas: não adivinha — não reativa nenhuma', async () => {
    const tables = baseTables();
    tables.debts[0].description = 'Cobrança não paga — Plano Premium (PIX)';
    tables.client_subscriptions.push({
      id: 'sub-2',
      clientId: 'client-1',
      status: 'SUSPENDED',
      endDate: YESTERDAY,
      startDate: '2026-05-13T13:31:32.756',
      createdAt: '2026-05-13T13:31:32.756',
      cutsUsedThisMonth: 0,
    });
    const { service, state } = buildService(tables);

    await service.settleDebt('debt-1', 'CASH');

    expect(state.debts[0].isSettled).toBe(true);
    expect(state.client_subscriptions.every((s) => s.status === 'SUSPENDED')).toBe(true);
  });

  it('assinatura já ACTIVE: quita sem mexer no ciclo (idempotente)', async () => {
    const tables = taggedTables();
    tables.client_subscriptions[0].status = 'ACTIVE';
    tables.client_subscriptions[0].endDate = '2099-01-01T00:00:00';
    tables.client_subscriptions[0].cutsUsedThisMonth = 3;
    const { service, state } = buildService(tables);

    await service.settleDebt('debt-1', 'CASH');

    expect(state.debts[0].isSettled).toBe(true);
    expect(state.client_subscriptions[0].endDate).toBe('2099-01-01T00:00:00');
    expect(state.client_subscriptions[0].cutsUsedThisMonth).toBe(3);
  });
});
