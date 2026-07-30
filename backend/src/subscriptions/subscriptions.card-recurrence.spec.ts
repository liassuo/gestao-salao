/**
 * Regressão do ciclo vicioso da recorrência no CARTÃO (investigação 2026-07-30).
 *
 * Evidência de produção: o Asaas cobra o cartão certinho todo mês (assinatura
 * nativa CREDIT_CARD), mas o estado local não registra a renovação quando o
 * webhook se perde. O app então:
 *   1. suspende + cria dívida ("inadimplente") mesmo com o cartão debitado;
 *   2. quando o admin/cliente clica Renovar/Reativar, CANCELA a assinatura Asaas
 *      de cartão que funcionava e recria como UNDEFINED/PIX — matando o débito
 *      automático para sempre.
 *
 * Estes testes garantem as três blindagens:
 *   - syncWithAsaas renova a janela de uma ACTIVE vencida quando o Asaas mostra
 *     a cobrança do novo ciclo paga (prova = pagamento >= endDate - 14d);
 *   - suspend-cron e leitura lazy perguntam ao Asaas ANTES de suspender/criar dívida;
 *   - fluxos de recriação curam pela reconciliação primeiro (heal-first) e se
 *     recusam a cancelar uma recorrência de cartão viva no Asaas.
 *
 * Usa o mesmo StatefulSupabase dos outros specs (sem rede/banco real).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { SubscriptionsService } from './subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
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
        if (mode === 'insert' || mode === 'update') {
          const res = runTerminal();
          return { data: res.data, error: res.data ? null : { code: 'PGRST116', message: 'No rows' } };
        }
        const rows = applyFilters(tables[table], filters);
        if (rows.length !== 1) {
          return { data: null, error: { code: 'PGRST116', message: 'No/many rows' } };
        }
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

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgoIso = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();
const daysAgoDateStr = (n: number) => daysAgoIso(n).substring(0, 10);

/** Cobrança Asaas (shape mínimo usado pelo service). Valor em reais. */
function asaasCharge(over: Partial<Record<string, any>> = {}) {
  return {
    id: 'pay_new',
    status: 'CONFIRMED',
    billingType: 'CREDIT_CARD',
    dueDate: daysAgoDateStr(1),
    confirmedDate: daysAgoDateStr(1),
    paymentDate: null,
    value: 80,
    invoiceUrl: 'https://asaas/inv',
    bankSlipUrl: null,
    ...over,
  };
}

async function buildService(initial: Tables, asaasOver: Partial<Record<string, any>> = {}) {
  const sb = createStatefulSupabase(initial);
  const asaasMock: any = {
    configured: true,
    centavosToReais: (c: number) => Math.round(c) / 100,
    reaisToCentavos: (r: number) => Math.round(r * 100),
    getSubscription: jest.fn().mockResolvedValue(null),
    getSubscriptionPayments: jest.fn().mockResolvedValue([]),
    getPayments: jest.fn().mockResolvedValue({ data: [] }),
    getCharge: jest.fn().mockRejectedValue(new Error('not found')),
    createSubscription: jest.fn().mockResolvedValue({ id: 'sub_asaas_new' }),
    cancelSubscription: jest.fn().mockResolvedValue({}),
    cancelCharge: jest.fn().mockResolvedValue({}),
    createCustomer: jest.fn().mockResolvedValue({ id: 'cus_1' }),
    findCustomerByExternalReference: jest.fn().mockResolvedValue({ id: 'cus_1' }),
    getPixQrCode: jest.fn().mockResolvedValue(null),
    ...asaasOver,
  };
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      SubscriptionsService,
      { provide: SupabaseService, useValue: sb },
      { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
      { provide: AsaasService, useValue: asaasMock },
      { provide: CashRegisterService, useValue: new CashRegisterService(sb as any) },
      {
        provide: NotificationsService,
        useValue: { notifySubscriptionOverdue: jest.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();

  const service = moduleRef.get(SubscriptionsService);
  return { service, state: (sb as any)._state as Tables, asaas: asaasMock };
}

/** Assinatura local ACTIVE vencida ontem, ciclo anterior pago há 1 mês. */
function tablesActiveExpired(): Tables {
  return {
    users: [{ id: 'admin-1', role: 'ADMIN' }],
    clients: [{ id: 'client-1', name: 'João', phone: '1199', asaasCustomerId: 'cus_1', cpf: '123' }],
    subscription_plans: [
      { id: 'plan-1', name: 'Mensal', price: 8000, cutsPerMonth: 4, discountPercent: 0, isActive: true },
    ],
    subscription_plan_services: [],
    client_subscriptions: [
      {
        id: 'sub-1',
        clientId: 'client-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        canceledAt: null,
        isComp: false,
        startDate: daysAgoIso(31),
        endDate: daysAgoIso(1),
        createdAt: daysAgoIso(31),
        updatedAt: daysAgoIso(1),
        asaasSubscriptionId: 'sub_asaas_1',
        cutsUsedThisMonth: 2,
      },
    ],
    payments: [
      {
        id: 'pay-old',
        clientId: 'client-1',
        subscriptionId: 'sub-1',
        amount: 8000,
        method: 'CARD',
        asaasPaymentId: 'pay_old',
        asaasStatus: 'RECEIVED',
        paidAt: daysAgoIso(31),
        createdAt: daysAgoIso(31),
      },
    ],
    debts: [],
    cash_registers: [{ id: 'caixa-hoje', isOpen: true, date: localDateString() }],
  };
}

describe('syncWithAsaas — ACTIVE vencida com renovação paga no Asaas', () => {
  it('renova a janela (endDate +1 mês) e registra o pagamento do novo ciclo', async () => {
    const charges = [
      asaasCharge({ id: 'pay_new', confirmedDate: daysAgoDateStr(1), dueDate: daysAgoDateStr(1) }),
      asaasCharge({ id: 'pay_old', status: 'RECEIVED', confirmedDate: daysAgoDateStr(31), paymentDate: daysAgoDateStr(31), dueDate: daysAgoDateStr(31) }),
    ];
    const { service, state } = await buildService(tablesActiveExpired(), {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
      getCharge: jest.fn().mockResolvedValue(charges[1]),
    });

    const synced = await service.syncWithAsaas('sub-1');

    expect(synced.status).toBe('ACTIVE');
    // Janela renovada: novo endDate no futuro (dia-âncora: vencimento antigo +1 mês)
    expect(new Date(synced.endDate).getTime()).toBeGreaterThan(Date.now());
    // Pagamento do novo ciclo registrado como pago
    const newPay = state.payments.find((p) => p.asaasPaymentId === 'pay_new');
    expect(newPay).toBeTruthy();
    expect(newPay!.paidAt).toBeTruthy();
    // Cortes zerados para o ciclo novo
    const row = state.client_subscriptions.find((s) => s.id === 'sub-1');
    expect(row!.cutsUsedThisMonth).toBe(0);
  });
});

describe('suspendExpiredActiveSubscriptionsCron — pergunta ao Asaas antes de suspender', () => {
  it('NÃO suspende nem cria dívida quando o Asaas mostra a renovação paga', async () => {
    const charges = [asaasCharge({ id: 'pay_new' })];
    const { service, state } = await buildService(tablesActiveExpired(), {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    await service.suspendExpiredActiveSubscriptionsCron();

    const row = state.client_subscriptions.find((s) => s.id === 'sub-1');
    expect(row!.status).toBe('ACTIVE');
    expect(new Date(row!.endDate).getTime()).toBeGreaterThan(Date.now());
    expect(state.debts).toHaveLength(0);
  });

  it('ADIA a suspensão enquanto a fatura do ciclo ainda está no prazo no Asaas (dueDate hoje)', async () => {
    // Cartão cobra na manhã do vencimento; PIX o cliente paga até o fim do dia.
    // Fatura PENDING com dueDate >= hoje (e dentro do ciclo) → não suspende ainda.
    const charges = [
      asaasCharge({ id: 'pay_new', status: 'PENDING', confirmedDate: null, dueDate: daysAgoDateStr(0) }),
    ];
    const { service, state } = await buildService(tablesActiveExpired(), {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    await service.suspendExpiredActiveSubscriptionsCron();

    const row = state.client_subscriptions.find((s) => s.id === 'sub-1');
    expect(row!.status).toBe('ACTIVE'); // adiado — próximo cron decide
    expect(state.debts).toHaveLength(0);
  });

  it('fatura pré-gerada do ciclo SEGUINTE (dueDate +1 mês) NÃO adia a suspensão', async () => {
    // O Asaas pré-gera a fatura do próximo ciclo ~1 mês antes; ela não pode servir
    // de álibi eterno — só a fatura do ciclo corrente (dueDate <= endDate + 2d) adia.
    const charges = [
      asaasCharge({
        id: 'pay_next',
        status: 'PENDING',
        confirmedDate: null,
        dueDate: new Date(Date.now() + 29 * DAY_MS).toISOString().substring(0, 10),
      }),
    ];
    const { service, state } = await buildService(tablesActiveExpired(), {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    await service.suspendExpiredActiveSubscriptionsCron();

    const row = state.client_subscriptions.find((s) => s.id === 'sub-1');
    expect(row!.status).toBe('SUSPENDED');
  });

  it('segue suspendendo quando o Asaas NÃO mostra pagamento do novo ciclo', async () => {
    // Só a cobrança nova PENDENTE (não paga) no Asaas.
    const charges = [asaasCharge({ id: 'pay_new', status: 'PENDING', confirmedDate: null })];
    const { service, state } = await buildService(tablesActiveExpired(), {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    await service.suspendExpiredActiveSubscriptionsCron();

    const row = state.client_subscriptions.find((s) => s.id === 'sub-1');
    expect(row!.status).toBe('SUSPENDED');
  });
});

describe('findClientSubscription — auto-reconciliação de SUSPENDED recente', () => {
  it('cura SUSPENDED recente quando o Asaas mostra a renovação paga', async () => {
    const tables = tablesActiveExpired();
    tables.client_subscriptions[0].status = 'SUSPENDED';
    tables.client_subscriptions[0].endDate = daysAgoIso(3);
    tables.client_subscriptions[0].updatedAt = daysAgoIso(0);
    const charges = [
      asaasCharge({ id: 'pay_new', confirmedDate: daysAgoDateStr(2), dueDate: daysAgoDateStr(3) }),
    ];
    const { service } = await buildService(tables, {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    const sub = await service.findClientSubscription('client-1');

    expect(sub.status).toBe('ACTIVE');
    expect(new Date(sub.endDate).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('reactivateMySubscription — heal-first, não recria recorrência', () => {
  it('reativa pela reconciliação e NÃO cria/cancela assinatura Asaas quando o ciclo está pago lá', async () => {
    const tables = tablesActiveExpired();
    tables.client_subscriptions[0].status = 'SUSPENDED';
    tables.client_subscriptions[0].endDate = daysAgoIso(1);
    // Dívida de inadimplência criada pela suspensão — deve ser quitada na cura.
    tables.debts = [
      {
        id: 'debt-1',
        clientId: 'client-1',
        amount: 8000,
        amountPaid: 0,
        remainingBalance: 8000,
        isSettled: false,
        description: 'Cobrança não paga — Mensal (Cartão) [sub:sub-1:cycle:x]',
      },
    ];
    const charges = [asaasCharge({ id: 'pay_new' })];
    const { service, state, asaas } = await buildService(tables, {
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    const result = await service.reactivateMySubscription('client-1', {} as any);

    expect(result.subscription.status).toBe('ACTIVE');
    expect(asaas.createSubscription).not.toHaveBeenCalled();
    expect(asaas.cancelSubscription).not.toHaveBeenCalled();
    const debt = state.debts.find((d) => d.id === 'debt-1');
    expect(debt!.isSettled).toBe(true);
  });
});

describe('createRecurringSubscriptionAndFirstCharge — guarda da recorrência de cartão viva', () => {
  it('renewSubscriptionViaAsaas recusa recriar quando a assinatura Asaas de CARTÃO está ativa e cobrando', async () => {
    const tables = tablesActiveExpired();
    // SUSPENDED há 5 dias; última cobrança de cartão paga há 20 dias (fora da
    // janela de prova de renovação, mas recente o bastante p/ provar recorrência viva).
    tables.client_subscriptions[0].status = 'SUSPENDED';
    tables.client_subscriptions[0].endDate = daysAgoIso(5);
    const charges = [
      asaasCharge({
        id: 'pay_old20',
        status: 'CONFIRMED',
        confirmedDate: daysAgoDateStr(20),
        dueDate: daysAgoDateStr(20),
      }),
    ];
    const { service, state, asaas } = await buildService(tables, {
      getSubscription: jest.fn().mockResolvedValue({
        id: 'sub_asaas_1',
        status: 'ACTIVE',
        billingType: 'CREDIT_CARD',
        deleted: false,
      }),
      getSubscriptionPayments: jest.fn().mockResolvedValue(charges),
    });

    await expect(service.renewSubscriptionViaAsaas('sub-1')).rejects.toThrow(BadRequestException);

    // A recorrência de cartão NÃO foi cancelada nem recriada.
    expect(asaas.cancelSubscription).not.toHaveBeenCalled();
    expect(asaas.createSubscription).not.toHaveBeenCalled();
    // Status local voltou ao que era (não fica preso em PENDING_PAYMENT).
    const row = state.client_subscriptions.find((s) => s.id === 'sub-1');
    expect(row!.status).toBe('SUSPENDED');
  });
});
