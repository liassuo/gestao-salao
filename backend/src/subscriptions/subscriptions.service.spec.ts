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
