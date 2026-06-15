/**
 * Regressão do fluxo de assinatura PAGA NO BALCÃO.
 *
 * Caso reportado pelo dono: "renovei a assinatura hoje, automaticamente caiu no
 * caixa de hoje e contabilizava certinho" — comportamento que tinha se perdido.
 * Desde que a assinatura passou a nascer sempre PENDING_PAYMENT, renovar/assinar
 * no balcão deixava de lançar o pagamento no caixa (virava processo de 2 passos
 * e, se o admin não confirmasse o pagamento à parte, a receita nunca entrava).
 *
 * Estes testes garantem que, com `paymentMethod` presente, subscribeClient:
 *  - ativa a assinatura na hora (ACTIVE), e
 *  - grava um payment com businessDate = hoje, vinculado ao caixa do dia,
 *  - sem gerar cobrança Asaas.
 * E que, SEM `paymentMethod`, continua nascendo PENDING_PAYMENT (não ativa de
 * graça — proteção do caso Kleudson).
 *
 * Usa o mesmo StatefulSupabase do webhook spec (sem rede/banco real).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { SubscriptionsService } from './subscriptions.service';
import { localDateString } from '../common/datetime.util';

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function createStatefulSupabase(initial: Tables = {}) {
  const tables: Tables = {};
  for (const [k, v] of Object.entries(initial)) tables[k] = [...v];

  function applyFilters(rows: Row[], filters: any[]): Row[] {
    return rows.filter((r) =>
      filters.every(([op, col, val]) => {
        if (op === 'eq') return r[col] === val;
        if (op === 'is') return r[col] === val;
        if (op === 'in') return val.includes(r[col]);
        if (op === 'gte') return r[col] >= val;
        if (op === 'lte') return r[col] <= val;
        if (op === 'lt') return r[col] < val;
        if (op === 'not-is') return r[col] !== val;
        if (op === 'gt') return r[col] > val;
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

    const chain: any = {
      select: () => chain,
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
      delete: () => {
        mode = 'delete';
        return chain;
      },
      eq: (col: string, val: any) => (filters.push(['eq', col, val]), chain),
      is: (col: string, val: any) => (filters.push(['is', col, val]), chain),
      not: (col: string, _: string, val: any) => (filters.push(['not-is', col, val]), chain),
      in: (col: string, vals: any[]) => (filters.push(['in', col, vals]), chain),
      ilike: (col: string, val: string) => (filters.push(['ilike', col, val]), chain),
      neq: (col: string, val: any) => (filters.push(['not-is', col, val]), chain),
      gte: (col: string, v: any) => (filters.push(['gte', col, v]), chain),
      lte: (col: string, v: any) => (filters.push(['lte', col, v]), chain),
      gt: (col: string, v: any) => (filters.push(['gt', col, v]), chain),
      lt: (col: string, v: any) => (filters.push(['lt', col, v]), chain),
      order: () => chain,
      limit: () => chain,
      single: async () => {
        // insert/update retornam a linha afetada (.select().single()); select puro
        // filtra a tabela. Espelha o PostgREST: 0 ou >1 vira erro PGRST116.
        if (mode === 'insert' || mode === 'update') {
          const res = runTerminal();
          return { data: res.data, error: res.data ? null : { code: 'PGRST116', message: 'No rows' } };
        }
        const rows = applyFilters(tables[table], filters);
        if (rows.length !== 1) {
          return { data: null, error: { code: 'PGRST116', message: 'No/many rows' } };
        }
        return { data: rows[0], error: null };
      },
      maybeSingle: async () => {
        if (mode === 'insert' || mode === 'update') {
          const res = runTerminal();
          return { data: res.data, error: null };
        }
        const rows = applyFilters(tables[table], filters);
        return { data: rows[0] ?? null, error: null };
      },
      then: (resolve: any) => Promise.resolve(runTerminal()).then(resolve),
    };

    function runTerminal(): { data: any; error: any } {
      if (mode === 'insert') {
        for (const row of payload) tables[table].push({ ...row });
        return { data: payload[0], error: null };
      }
      if (mode === 'update') {
        const matched = applyFilters(tables[table], filters);
        for (const row of matched) Object.assign(row, updatePayload);
        return { data: matched[0] ?? null, error: null };
      }
      if (mode === 'delete') {
        const keep = tables[table].filter((r) => !applyFilters([r], filters).length);
        tables[table] = keep;
        return { data: null, error: null };
      }
      return { data: applyFilters(tables[table], filters), error: null };
    }

    return chain;
  }

  return { from: (table: string) => builder(table), _state: tables };
}

async function buildService(initial: Tables, asaasConfigured = false) {
  const sb = createStatefulSupabase(initial);
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      SubscriptionsService,
      { provide: SupabaseService, useValue: sb },
      { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
      { provide: AsaasService, useValue: { configured: asaasConfigured } },
      { provide: CashRegisterService, useValue: new CashRegisterService(sb as any) },
    ],
  }).compile();

  const service = moduleRef.get(SubscriptionsService);
  return { service, state: (sb as any)._state as Tables };
}

function baseTables(): Tables {
  return {
    users: [{ id: 'admin-1', role: 'ADMIN' }],
    clients: [{ id: 'client-1', name: 'João', phone: '1199' }],
    subscription_plans: [
      { id: 'plan-1', name: 'Mensal', price: 8000, cutsPerMonth: 4, discountPercent: 0, isActive: true },
    ],
    subscription_plan_services: [],
    client_subscriptions: [],
    payments: [],
    cash_registers: [{ id: 'caixa-hoje', isOpen: true, date: localDateString() }],
  };
}

describe('SubscriptionsService — assinatura paga no balcão', () => {
  it('com paymentMethod=CASH: ativa na hora e lança pagamento no caixa de hoje', async () => {
    const { service, state } = await buildService(baseTables());

    const sub = await service.subscribeClient({
      clientId: 'client-1',
      planId: 'plan-1',
      paymentMethod: 'CASH',
    } as any);

    // Assinatura nasce ATIVA (não PENDING_PAYMENT)
    expect(sub.status).toBe('ACTIVE');

    // Pagamento gravado, vinculado à assinatura, no caixa de hoje
    const pays = state.payments;
    expect(pays).toHaveLength(1);
    expect(pays[0].method).toBe('CASH');
    expect(pays[0].amount).toBe(8000);
    expect(pays[0].subscriptionId).toBe(sub.id);
    expect(pays[0].paidAt).toBeTruthy();
    // businessDate = hoje (assinatura não tem agendamento)
    expect(String(pays[0].businessDate).substring(0, 10)).toBe(localDateString());
    // vinculado ao caixa aberto de hoje
    expect(pays[0].cashRegisterId).toBe('caixa-hoje');
  });

  it('renovação no balcão de uma assinatura SUSPENSA: reusa a linha, ativa e cai no caixa', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-old',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'SUSPENDED',
        cutsUsedThisMonth: 3,
        endDate: '2026-01-01T00:00:00',
      },
    ];
    const { service, state } = await buildService(tables);

    const sub = await service.subscribeClient({
      clientId: 'client-1',
      planId: 'plan-1',
      paymentMethod: 'PIX',
    } as any);

    expect(sub.id).toBe('sub-old'); // reaproveitou a mesma linha
    expect(sub.status).toBe('ACTIVE');
    expect(sub.cutsUsedThisMonth).toBe(0); // cortes zerados na renovação

    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].method).toBe('PIX');
    expect(state.payments[0].cashRegisterId).toBe('caixa-hoje');
  });

  it('SEM paymentMethod: nasce PENDING_PAYMENT e NÃO lança pagamento (não ativa de graça)', async () => {
    const { service, state } = await buildService(baseTables());

    const sub = await service.subscribeClient({
      clientId: 'client-1',
      planId: 'plan-1',
    } as any);

    expect(sub.status).toBe('PENDING_PAYMENT');
    expect(state.payments).toHaveLength(0);
  });
});

describe('SubscriptionsService — inadimplência confiável ao vencer (independe do webhook OVERDUE)', () => {
  it('cron: assinatura ACTIVE vencida sem pagamento vira SUSPENDED + cria dívida + marca hasDebts', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-1',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        canceledAt: null,
        endDate: '2020-01-01T00:00:00.000',
        plan: { name: 'Mensal', price: 8000 },
      },
    ];
    tables.payments = [
      { id: 'pay-1', subscriptionId: 'sub-1', clientId: 'client-1', method: 'PIX', asaasStatus: 'CONFIRMED', paidAt: '2019-12-01T00:00:00', createdAt: '2019-12-01T00:00:00' },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: false }];
    tables.debts = [];
    const { service, state } = await buildService(tables);

    await service.suspendExpiredActiveSubscriptionsCron();

    expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
    expect(state.debts).toHaveLength(1);
    expect(state.debts[0].clientId).toBe('client-1');
    expect(state.debts[0].amount).toBe(8000);
    expect(state.debts[0].isSettled).toBe(false);
    expect(state.debts[0].description).toContain('Cobrança não paga');
    expect(state.debts[0].description).toContain('[sub:sub-1');
    expect(state.clients[0].hasDebts).toBe(true);
  });

  it('cron: não duplica dívida quando o cliente já tem cobrança de assinatura em aberto (dedup com webhook OVERDUE)', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-1',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        canceledAt: null,
        endDate: '2020-01-01T00:00:00.000',
        plan: { name: 'Mensal', price: 8000 },
      },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: true }];
    tables.debts = [
      { id: 'd0', clientId: 'client-1', description: 'Cobrança não paga — Mensal [asaas:x]', amount: 8000, isSettled: false },
    ];
    const { service, state } = await buildService(tables);

    await service.suspendExpiredActiveSubscriptionsCron();

    expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
    expect(state.debts).toHaveLength(1); // não cria 2ª dívida
  });

  it('leitura (findClientSubscription): assinatura ACTIVE vencida vira SUSPENDED + cria dívida na hora', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-1',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        canceledAt: null,
        startDate: '2019-12-01T00:00:00',
        endDate: '2020-01-01T00:00:00.000',
        cutsUsedThisMonth: 0,
        createdAt: '2019-12-01T00:00:00',
        plan: { id: 'plan-1', name: 'Mensal', price: 8000, cutsPerMonth: 4 },
      },
    ];
    tables.payments = [];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: false }];
    tables.debts = [];
    const { service, state } = await buildService(tables);

    const sub = await service.findClientSubscription('client-1');

    expect(sub.status).toBe('SUSPENDED');
    expect(state.debts).toHaveLength(1);
    expect(state.debts[0].description).toContain('Cobrança não paga');
    expect(state.clients[0].hasDebts).toBe(true);
  });

  it('cron: assinatura cancelada (canceledAt setado) vencida NÃO gera dívida (é tratada como cancelamento)', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-1',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        canceledAt: '2019-12-15T00:00:00',
        endDate: '2020-01-01T00:00:00.000',
        plan: { name: 'Mensal', price: 8000 },
      },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: false }];
    tables.debts = [];
    const { service, state } = await buildService(tables);

    await service.suspendExpiredActiveSubscriptionsCron();

    // canceladas vencidas são do outro cron (→ CANCELED) — este não as toca nem cria dívida.
    expect(state.debts).toHaveLength(0);
  });
});

describe('SubscriptionsService — findAllSubscriptions expõe método e inadimplência pro admin', () => {
  it('anexa latestPayment.method e inadimplente=true quando há dívida de assinatura aberta', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'SUSPENDED', createdAt: '2026-06-01T00:00:00', endDate: '2026-06-01T00:00:00' },
    ];
    tables.payments = [
      { id: 'pay-1', subscriptionId: 'sub-1', clientId: 'client-1', method: 'CARD', asaasStatus: 'OVERDUE', createdAt: '2026-06-01T00:00:00' },
    ];
    tables.debts = [
      { id: 'd1', clientId: 'client-1', description: 'Cobrança não paga — Mensal', isSettled: false, amount: 8000 },
    ];
    const { service } = await buildService(tables);

    const list = await service.findAllSubscriptions();

    expect(list).toHaveLength(1);
    expect((list[0] as any).latestPayment?.method).toBe('CARD');
    expect((list[0] as any).inadimplente).toBe(true);
  });

  it('inadimplente=false e expõe o método quando a assinatura está em dia', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', createdAt: '2026-06-01T00:00:00', endDate: '2026-12-01T00:00:00' },
    ];
    tables.payments = [
      { id: 'pay-1', subscriptionId: 'sub-1', clientId: 'client-1', method: 'PIX', asaasStatus: 'CONFIRMED', paidAt: '2026-06-01T00:00:00', createdAt: '2026-06-01T00:00:00' },
    ];
    tables.debts = [];
    const { service } = await buildService(tables);

    const list = await service.findAllSubscriptions();
    expect((list[0] as any).latestPayment?.method).toBe('PIX');
    expect((list[0] as any).inadimplente).toBe(false);
  });

  // Badge "Ciclo não pago": a LISTA do admin anexa currentCyclePaid/paymentStatus
  // sem N+1 (derivado do batch de payments), espelhando isCurrentCyclePaid.
  it('currentCyclePaid=true + paymentStatus=PAID quando ACTIVE tem pagamento no ciclo', async () => {
    const recent = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', startDate: recent(-1), createdAt: recent(-1), endDate: recent(29) },
    ];
    tables.payments = [
      { id: 'pay-1', subscriptionId: 'sub-1', clientId: 'client-1', method: 'CARD', paidAt: recent(0), createdAt: recent(0) },
    ];
    tables.debts = [];
    const { service } = await buildService(tables);
    const list = await service.findAllSubscriptions();
    expect((list[0] as any).currentCyclePaid).toBe(true);
    expect((list[0] as any).paymentStatus).toBe('PAID');
  });

  it('currentCyclePaid=false + paymentStatus=PENDING quando ACTIVE sem pagamento no ciclo', async () => {
    const recent = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', startDate: recent(-1), createdAt: recent(-1), endDate: recent(29) },
    ];
    tables.payments = []; // nenhum pagamento no ciclo vigente
    tables.debts = [];
    const { service } = await buildService(tables);
    const list = await service.findAllSubscriptions();
    expect((list[0] as any).currentCyclePaid).toBe(false);
    expect((list[0] as any).paymentStatus).toBe('PENDING');
  });

  it('ACTIVE vencida NÃO vira "em dia": currentCyclePaid=undefined (espelha o gate de preço)', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      // endDate no passado, mas status ainda ACTIVE (cron de expiração não rodou).
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', startDate: '2026-01-01T00:00:00', createdAt: '2026-01-01T00:00:00', endDate: '2026-02-01T00:00:00' },
    ];
    tables.payments = [
      { id: 'pay-1', subscriptionId: 'sub-1', clientId: 'client-1', method: 'PIX', paidAt: '2026-01-02T00:00:00', createdAt: '2026-01-02T00:00:00' },
    ];
    tables.debts = [];
    const { service } = await buildService(tables);
    const list = await service.findAllSubscriptions();
    expect((list[0] as any).currentCyclePaid).toBeUndefined();
    expect((list[0] as any).paymentStatus).toBeNull();
  });
});

/**
 * Renovação via link Asaas (admin): gera invoiceUrl pro cliente pagar remoto.
 * Salvaguardas: não ativa nem lança no caixa ao gerar o link; só renova status
 * não-ativos (ACTIVE tem fluxo próprio); exige Asaas configurado.
 */
describe('SubscriptionsService — renovação via link Asaas (renewSubscriptionViaAsaas)', () => {
  it('rejeita quando o Asaas não está configurado', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'SUSPENDED', plan: { id: 'plan-1', name: 'Mensal', price: 8000 } },
    ];
    const { service } = await buildService(tables, false); // asaasConfigured=false
    await expect(service.renewSubscriptionViaAsaas('sub-1')).rejects.toThrow(/Asaas não está configurada/i);
  });

  it('rejeita renovar uma assinatura ACTIVE (não recobra quem está em dia por aqui)', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', endDate: '2026-12-01T00:00:00', plan: { id: 'plan-1', name: 'Mensal', price: 8000 } },
    ];
    const { service } = await buildService(tables, true); // asaasConfigured=true
    await expect(service.renewSubscriptionViaAsaas('sub-1')).rejects.toThrow(/não pode ser renovada/i);
    // status inalterado (não virou PENDING_PAYMENT)
    expect(tables.client_subscriptions[0].status).toBe('ACTIVE');
  });
});

/**
 * Confirmar pagamento do CICLO de uma assinatura ACTIVE não paga (cliente pagou por
 * fora). Só registra o pagamento — NÃO mexe no vencimento nem zera os cortes.
 */
describe('SubscriptionsService — confirmar pagamento do ciclo (ACTIVE não paga)', () => {
  it('registra o pagamento e NÃO altera endDate nem cutsUsedThisMonth', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE',
        startDate: '2026-06-06T00:00:00', endDate: '2026-07-06T00:00:00',
        cutsUsedThisMonth: 1,
        plan: { id: 'plan-1', name: 'Mensal', price: 7000 },
      },
    ];
    const { service, state } = await buildService(tables);

    await service.confirmCyclePaymentManually('sub-1', 'PIX');

    // pagamento registrado (vai pro caixa)
    const pay = state.payments.find((p) => p.subscriptionId === 'sub-1');
    expect(pay).toBeTruthy();
    expect(pay!.method).toBe('PIX');
    expect(pay!.amount).toBe(7000);
    expect(pay!.paidAt).toBeTruthy();
    // NÃO mexeu no vencimento nem nos cortes
    const sub = state.client_subscriptions[0];
    expect(sub.endDate).toBe('2026-07-06T00:00:00');
    expect(sub.cutsUsedThisMonth).toBe(1);
    expect(sub.status).toBe('ACTIVE');
  });

  it('rejeita se a assinatura não está ACTIVE', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'PENDING_PAYMENT', plan: { id: 'plan-1', name: 'Mensal', price: 7000 } },
    ];
    const { service } = await buildService(tables);
    await expect(service.confirmCyclePaymentManually('sub-1', 'CASH')).rejects.toThrow(/ativa/i);
  });

  it('BLOQUEIA quando o ciclo JÁ tem pagamento (anti-duplicata no caixa)', async () => {
    const recent = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', startDate: recent(-1), createdAt: recent(-1), endDate: recent(29), plan: { id: 'plan-1', name: 'Mensal', price: 7000 } },
    ];
    // já existe pagamento do ciclo (ex: cartão recorrente do Asaas caiu)
    tables.payments = [
      { id: 'pay-real', subscriptionId: 'sub-1', clientId: 'client-1', method: 'CARD', paidAt: recent(0), createdAt: recent(0), asaasPaymentId: 'pay_xyz' },
    ];
    const { service, state } = await buildService(tables);
    await expect(service.confirmCyclePaymentManually('sub-1', 'CASH')).rejects.toThrow(/já tem pagamento/i);
    // não criou um 2º pagamento (não duplicou no caixa)
    expect(state.payments.length).toBe(1);
  });
});

describe('SubscriptionsService — assinatura CORTESIA (grátis)', () => {
  const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

  it('concede ACTIVE com isComp=true e NÃO registra pagamento (não entra no caixa)', async () => {
    const { service, state } = await buildService(baseTables());

    const sub = await service.grantCourtesy({
      clientId: 'client-1',
      planId: 'plan-1',
      endDate: future(15),
    } as any);

    expect(sub.status).toBe('ACTIVE');
    expect(sub.isComp).toBe(true);
    expect(state.payments).toHaveLength(0); // cortesia: sem receita/caixa
    expect(state.client_subscriptions).toHaveLength(1);
    expect(String(state.client_subscriptions[0].endDate).substring(0, 10)).toBe(
      future(15).substring(0, 10),
    );
  });

  it('com paymentMethod: contabiliza a 1ª mensalidade no caixa e isComp=false (assinatura paga)', async () => {
    const { service, state } = await buildService(baseTables());

    const sub = await service.grantCourtesy({
      clientId: 'client-1',
      planId: 'plan-1',
      endDate: future(15),
      paymentMethod: 'PIX',
    } as any);

    expect(sub.status).toBe('ACTIVE');
    expect(sub.isComp).toBe(false); // contabilizado = paga, não é cortesia
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].method).toBe('PIX');
    expect(state.payments[0].amount).toBe(8000);
    expect(state.payments[0].subscriptionId).toBe(sub.id);
    expect(state.payments[0].paidAt).toBeTruthy();
    expect(state.payments[0].cashRegisterId).toBe('caixa-hoje');
  });

  it('rejeita término além de 1 mês', async () => {
    const { service } = await buildService(baseTables());
    await expect(
      service.grantCourtesy({ clientId: 'client-1', planId: 'plan-1', endDate: future(45) } as any),
    ).rejects.toThrow(/1 m[êe]s/i);
  });

  it('rejeita término no passado', async () => {
    const { service } = await buildService(baseTables());
    await expect(
      service.grantCourtesy({ clientId: 'client-1', planId: 'plan-1', endDate: future(-1) } as any),
    ).rejects.toThrow(/futura/i);
  });

  it('rejeita se o cliente já tem assinatura ativa', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-x', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE', endDate: future(20) },
    ];
    const { service } = await buildService(tables);
    await expect(
      service.grantCourtesy({ clientId: 'client-1', planId: 'plan-1', endDate: future(10) } as any),
    ).rejects.toThrow(/já possui/i);
  });

  it('reaproveita a linha EXPIRED do cliente (constraint UNIQUE no clientId)', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-old', clientId: 'client-1', planId: 'plan-1', status: 'EXPIRED', endDate: '2020-01-01T00:00:00', isComp: false },
    ];
    const { service, state } = await buildService(tables);

    const sub = await service.grantCourtesy({
      clientId: 'client-1',
      planId: 'plan-1',
      endDate: future(10),
    } as any);

    expect(sub.id).toBe('sub-old');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.isComp).toBe(true);
    expect(state.client_subscriptions).toHaveLength(1); // reusou, não duplicou
  });

  it('cron: cortesia vencida vira EXPIRED e NÃO gera dívida', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-comp', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE',
        canceledAt: null, isComp: true, endDate: '2020-01-01T00:00:00.000',
        plan: { name: 'Mensal', price: 8000 },
      },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: false }];
    tables.debts = [];
    const { service, state } = await buildService(tables);

    await service.suspendExpiredActiveSubscriptionsCron();

    expect(state.client_subscriptions[0].status).toBe('EXPIRED');
    expect(state.debts).toHaveLength(0); // cortesia não vira inadimplência
    expect(state.clients[0].hasDebts).toBe(false);
  });

  it('pagar o ciclo de uma cortesia reseta isComp=false (lapso futuro cobra normal)', async () => {
    const recent = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
    const tables = baseTables();
    tables.client_subscriptions = [
      {
        id: 'sub-comp', clientId: 'client-1', planId: 'plan-1', status: 'ACTIVE',
        isComp: true, startDate: recent(-1), createdAt: recent(-1), endDate: recent(20),
        cutsUsedThisMonth: 0, plan: { id: 'plan-1', name: 'Mensal', price: 8000 },
      },
    ];
    const { service, state } = await buildService(tables);

    await service.confirmCyclePaymentManually('sub-comp', 'CASH');

    expect(state.payments).toHaveLength(1); // virou pago
    expect(state.client_subscriptions[0].isComp).toBe(false);
  });
});

/**
 * Bug do teste do dono: cancelar uma assinatura com cobrança não paga deixava a
 * dívida em aberto + hasDebts → cliente cancelado aparecia "Inadimplente" fantasma.
 * Fix: cancelar anula as dívidas de assinatura em aberto (amountPaid=0, paidAt=null —
 * anulada, não paga) e recalcula hasDebts.
 */
describe('SubscriptionsService — cancelamento anula a dívida-fantasma da assinatura', () => {
  it('anula a dívida de assinatura e limpa hasDebts ao cancelar', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'SUSPENDED', canceledAt: null, endDate: '2020-01-01T00:00:00.000', asaasSubscriptionId: null, plan: { name: 'Mensal', price: 8000 } },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: true }];
    tables.debts = [
      { id: 'd-sub1', clientId: 'client-1', amount: 8000, amountPaid: 0, remainingBalance: 8000, description: 'Cobrança não paga — Mensal (PIX) [sub:sub-1:cycle:2020-01-01]', isSettled: false },
    ];
    const { service, state } = await buildService(tables);

    await service.cancelSubscription('sub-1', true);

    const d = state.debts.find((x) => x.id === 'd-sub1')!;
    expect(d.isSettled).toBe(true);
    expect(d.amountPaid).toBe(0); // anulada, NÃO paga
    expect(d.paidAt ?? null).toBeNull(); // sem fingir pagamento
    expect(d.description).toContain('[canceled]');
    expect(state.clients[0].hasDebts).toBe(false); // era a única dívida
    expect(state.client_subscriptions[0].status).toBe('CANCELED');
  });

  it('anula também a dívida do webhook OVERDUE (tag [asaas:], sem [sub:])', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'SUSPENDED', canceledAt: null, endDate: '2020-01-01T00:00:00.000', asaasSubscriptionId: null, plan: { name: 'Mensal', price: 8000 } },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: true }];
    tables.debts = [
      // dívida criada pelo webhook do Asaas — tag [asaas:], NÃO [sub:]
      { id: 'd-asaas', clientId: 'client-1', amount: 8000, amountPaid: 0, remainingBalance: 8000, description: 'Cobrança não paga — Mensal [asaas:pay_abc123]', isSettled: false },
    ];
    const { service, state } = await buildService(tables);

    await service.cancelSubscription('sub-1', true);

    expect(state.debts[0].isSettled).toBe(true);
    expect(state.clients[0].hasDebts).toBe(false);
  });

  it('mantém dívida AVULSA (não de assinatura) intacta ao cancelar', async () => {
    const tables = baseTables();
    tables.client_subscriptions = [
      { id: 'sub-1', clientId: 'client-1', planId: 'plan-1', status: 'SUSPENDED', canceledAt: null, endDate: '2020-01-01T00:00:00.000', asaasSubscriptionId: null, plan: { name: 'Mensal', price: 8000 } },
    ];
    tables.clients = [{ id: 'client-1', name: 'João', hasDebts: true }];
    tables.debts = [
      { id: 'd-sub1', clientId: 'client-1', amount: 8000, amountPaid: 0, remainingBalance: 8000, description: 'Cobrança não paga — Mensal (PIX) [sub:sub-1:cycle:2020-01-01]', isSettled: false },
      // dívida avulsa de comanda — NÃO começa com "Cobrança não paga" → deve ficar
      { id: 'd-avulsa', clientId: 'client-1', amount: 5000, amountPaid: 0, remainingBalance: 5000, description: 'Comanda em aberto — atendimento avulso', isSettled: false },
    ];
    const { service, state } = await buildService(tables);

    await service.cancelSubscription('sub-1', true);

    expect(state.debts.find((x) => x.id === 'd-sub1')!.isSettled).toBe(true);
    expect(state.debts.find((x) => x.id === 'd-avulsa')!.isSettled).toBe(false); // intacta
    expect(state.clients[0].hasDebts).toBe(true); // ainda deve a avulsa
  });
});

/**
 * Gate de pagamento do ciclo espelhado para o frontend e para o consumo de crédito.
 *
 * Bug: o modal/app mostrava o corte coberto pelo plano (olhando só status=ACTIVE)
 * enquanto a comanda cobrava cheio (getActiveClientSubscription exige ciclo pago).
 * Correção: findClientSubscription anexa `currentCyclePaid` (mesma fonte da verdade,
 * isCurrentCyclePaid) e useCut passa a barrar o débito de corte sem pagamento do
 * ciclo (antes consumia 1 corte E cobrava cheio — corrupção de saldo).
 */
describe('SubscriptionsService — gate de pagamento do ciclo (currentCyclePaid + useCut)', () => {
  // Ciclo vigente: começou ontem, vence daqui a ~1 mês — sempre "atual".
  const recent = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86400000).toISOString();

  function activeSubTables(withCyclePayment: boolean): Tables {
    const tables = baseTables();
    // Plano ilimitado (99): isola o teste no GATE de pagamento, sem depender do
    // saldo de cortes (o join do plano no mock não traz cutsPerMonth pro useCut).
    tables.subscription_plans = [
      { id: 'plan-1', name: 'Ilimitado', price: 8000, cutsPerMonth: 99, discountPercent: 0, isActive: true },
    ];
    tables.client_subscriptions = [
      {
        id: 'sub-1',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        startDate: recent(-1),
        createdAt: recent(-1),
        endDate: recent(29),
        cutsUsedThisMonth: 1,
        // Plano embutido na linha: o mock não resolve o join aninhado (faz
        // passthrough da row), mesmo padrão do teste de findClientSubscription acima.
        plan: { id: 'plan-1', name: 'Ilimitado', price: 8000, cutsPerMonth: 99 },
      },
    ];
    tables.payments = withCyclePayment
      ? [
          {
            id: 'pay-cycle',
            subscriptionId: 'sub-1',
            clientId: 'client-1',
            method: 'CARD',
            paidAt: recent(0),
            createdAt: recent(0),
          },
        ]
      : [];
    tables.debts = [];
    return tables;
  }

  it('findClientSubscription: currentCyclePaid=true quando há pagamento no ciclo', async () => {
    const { service } = await buildService(activeSubTables(true));
    const sub = await service.findClientSubscription('client-1');
    expect(sub.status).toBe('ACTIVE');
    expect((sub as any).currentCyclePaid).toBe(true);
  });

  it('findClientSubscription: currentCyclePaid=false quando o ciclo NÃO foi pago', async () => {
    const { service } = await buildService(activeSubTables(false));
    const sub = await service.findClientSubscription('client-1');
    expect(sub.status).toBe('ACTIVE');
    expect((sub as any).currentCyclePaid).toBe(false);
  });

  it('useCut: debita o corte quando o ciclo está pago', async () => {
    const { service, state } = await buildService(activeSubTables(true));
    const updated = await service.useCut('sub-1');
    expect(updated.cutsUsedThisMonth).toBe(2); // 1 -> 2
    expect(state.client_subscriptions[0].cutsUsedThisMonth).toBe(2);
  });

  it('useCut: BLOQUEIA e NÃO debita quando o ciclo não foi pago', async () => {
    const { service, state } = await buildService(activeSubTables(false));
    await expect(service.useCut('sub-1')).rejects.toThrow(/pagamento do ciclo/i);
    // saldo intacto — não consumiu corte
    expect(state.client_subscriptions[0].cutsUsedThisMonth).toBe(1);
  });
});

/**
 * Regressão do caso Odilon: cliente pagou (Asaas RECEIVED) mas o webhook de confirmação
 * nunca processou (payments.asaasStatus ficou null). A reconciliação (botão "Reconciliar
 * com Asaas" / reconcilePendingSubscriptionsCron) recuperava o STATUS da assinatura
 * (PENDING_PAYMENT/SUSPENDED → ACTIVE) mas NÃO quitava a dívida de "Cobrança não paga"
 * nem limpava clients.hasDebts — então o cliente seguia INADIMPLENTE pra sempre, mesmo
 * pago. Só o caminho do webhook (settleOverdueDebtForPayment) limpava a dívida.
 *
 * Estes testes garantem que syncWithAsaas, ao ATIVAR com uma cobrança paga encontrada,
 * também quita a dívida do ciclo e recalcula hasDebts.
 */
function asaasMockWithPaidCharge() {
  const paidCharge = {
    id: 'pay_paid',
    status: 'RECEIVED',
    value: 70,
    externalReference: 'sub-1',
    paymentDate: localDateString(), // dentro do ciclo e no caixa de hoje
    billingType: 'PIX',
  };
  return {
    configured: true,
    reaisToCentavos: (reais: number) => Math.round((reais || 0) * 100),
    getSubscriptionPayments: async () => [],
    getPayments: async () => ({ data: [paidCharge] }),
    getCharge: async () => paidCharge,
  };
}

async function buildServiceWithAsaas(initial: Tables, asaasMock: any) {
  const sb = createStatefulSupabase(initial);
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      SubscriptionsService,
      { provide: SupabaseService, useValue: sb },
      { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
      { provide: AsaasService, useValue: asaasMock },
      { provide: CashRegisterService, useValue: new CashRegisterService(sb as any) },
    ],
  }).compile();
  return { service: moduleRef.get(SubscriptionsService), state: (sb as any)._state as Tables };
}

function odilonTables(): Tables {
  const t = baseTables();
  t.client_subscriptions = [
    {
      id: 'sub-1',
      clientId: 'client-1',
      planId: 'plan-1',
      status: 'PENDING_PAYMENT',
      asaasSubscriptionId: 'sub_asaas',
      startDate: '2020-01-01T00:00:00', // floor do ciclo bem no passado → cobrança paga conta
      createdAt: '2020-01-01T00:00:00',
      endDate: '2020-02-01T00:00:00',
      cutsUsedThisMonth: 4,
    },
  ];
  t.clients = [{ id: 'client-1', name: 'Odilon', phone: '1199', hasDebts: true }];
  t.debts = [
    {
      id: 'debt-1',
      clientId: 'client-1',
      amount: 7000,
      remainingBalance: 7000,
      amountPaid: 0,
      isSettled: false,
      description: 'Cobrança não paga — Mensal [sub:sub-1:cycle:2026-06-14]',
    },
  ];
  return t;
}

describe('SubscriptionsService — reconciliação quita a inadimplência (caso Odilon)', () => {
  it('syncWithAsaas: ao reativar com cobrança paga, quita a dívida e limpa hasDebts', async () => {
    const { service, state } = await buildServiceWithAsaas(odilonTables(), asaasMockWithPaidCharge());

    const updated = await service.reconcileSubscription('sub-1');

    // status recuperado
    expect((updated as any).status).toBe('ACTIVE');
    // dívida quitada
    expect(state.debts[0].isSettled).toBe(true);
    expect(state.debts[0].remainingBalance).toBe(0);
    // não está mais inadimplente
    expect(state.clients[0].hasDebts).toBe(false);
  });

  it('syncWithAsaas: NÃO mexe em dívidas quando não há cobrança paga (não some inadimplência indevida)', async () => {
    const t = odilonTables();
    const asaas = {
      configured: true,
      reaisToCentavos: (r: number) => Math.round((r || 0) * 100),
      getSubscriptionPayments: async () => [],
      getPayments: async () => ({ data: [{ id: 'pay_pend', status: 'PENDING', value: 70, externalReference: 'sub-1' }] }),
      getCharge: async () => ({ id: 'pay_pend', status: 'PENDING', value: 70 }),
    };
    const { service, state } = await buildServiceWithAsaas(t, asaas);

    const updated = await service.reconcileSubscription('sub-1');

    expect((updated as any).status).toBe('PENDING_PAYMENT'); // não ativou
    expect(state.debts[0].isSettled).toBe(false); // dívida intacta
    expect(state.clients[0].hasDebts).toBe(true);
  });
});

/**
 * Regressão "Ativo + Ciclo não pago": assinatura JÁ ACTIVE cujo pagamento do ciclo foi
 * recebido no Asaas (RECEIVED) mas o webhook se perdeu — o payment local ficou com paidAt
 * de um ciclo anterior (ex.: confirmedDate antecipado de cartão), então isCurrentCyclePaid
 * dá falso. Antes, syncWithAsaas saía cedo p/ TODA assinatura ACTIVE, então nem o botão nem
 * o cron curavam o "Ciclo não pago". Agora reconcilia ACTIVE quando o ciclo não consta pago:
 * corrige o paidAt local (sem renovar janela/zerar cortes nem mexer no caixa).
 */
function activeCicloTables(localPaidAt: string): Tables {
  const t = baseTables();
  t.client_subscriptions = [
    {
      id: 'sub-a',
      clientId: 'client-1',
      planId: 'plan-1',
      status: 'ACTIVE',
      startDate: '2026-06-06T00:00:00', // piso do ciclo = 2026-06-05
      createdAt: '2026-05-05T00:00:00',
      endDate: '2026-07-06T00:00:00',
      cutsUsedThisMonth: 2,
    },
  ];
  t.clients = [{ id: 'client-1', name: 'Lucas', phone: '1199', hasDebts: false }];
  t.debts = [];
  t.payments = [
    {
      id: 'pay-local',
      subscriptionId: 'sub-a',
      clientId: 'client-1',
      method: 'CARD',
      asaasPaymentId: 'pay_x',
      asaasStatus: 'CONFIRMED',
      paidAt: localPaidAt,
      businessDate: String(localPaidAt).substring(0, 10),
      createdAt: '2026-05-05T00:00:00',
    },
  ];
  return t;
}

function asaasInCycleCharge() {
  const charge = {
    id: 'pay_x',
    status: 'RECEIVED',
    value: 70,
    externalReference: 'sub-a',
    paymentDate: '2026-06-08', // dentro do ciclo (>= piso 06-05)
    billingType: 'CREDIT_CARD',
  };
  return {
    configured: true,
    reaisToCentavos: (reais: number) => Math.round((reais || 0) * 100),
    getSubscriptionPayments: async () => [],
    getPayments: async () => ({ data: [charge] }),
    getCharge: async () => charge,
  };
}

describe('SubscriptionsService — reconcilia ACTIVE com "Ciclo não pago" (webhook perdido)', () => {
  it('corrige o paidAt do ciclo (data real do Asaas) mantendo ACTIVE, sem renovar janela', async () => {
    // paidAt local 2026-05-05 (ciclo anterior) → isCurrentCyclePaid falso
    const { service, state } = await buildServiceWithAsaas(activeCicloTables('2026-05-05T12:00:00'), asaasInCycleCharge());

    const updated = await service.reconcileSubscription('sub-a');

    expect((updated as any).status).toBe('ACTIVE');
    // paidAt corrigido p/ a data real (dentro do ciclo) → some "Ciclo não pago"
    expect(String(state.payments[0].paidAt).startsWith('2026-06-08')).toBe(true);
    // NÃO renovou a janela nem zerou cortes (não é renovação)
    expect(state.client_subscriptions[0].endDate).toBe('2026-07-06T00:00:00');
    expect(state.client_subscriptions[0].cutsUsedThisMonth).toBe(2);
    // businessDate (caixa) preservado
    expect(state.payments[0].businessDate).toBe('2026-05-05');
  });

  it('ciclo já pago (paidAt dentro do ciclo): no-op, não duplica pagamento', async () => {
    const { service, state } = await buildServiceWithAsaas(activeCicloTables('2026-06-07T12:00:00'), asaasInCycleCharge());

    await service.reconcileSubscription('sub-a');

    expect(state.payments).toHaveLength(1); // não inseriu 2º payment
    expect(state.payments[0].paidAt).toBe('2026-06-07T12:00:00'); // intacto
  });
});
