/**
 * E2E do webhook Asaas: simula POSTs do gateway e valida o estado do
 * "banco" (Supabase mock stateful) após cada evento.
 *
 * Escopo:
 *  - PAYMENT_RECEIVED em payment de agendamento → marca isPaid, vincula
 *    cashRegisterId, atualiza order.paymentId, status PAID.
 *  - Idempotência: o mesmo evento entregue 2x não duplica side effects.
 *  - PAYMENT_OVERDUE em assinatura → suspende sub + cria dívida.
 *  - PAYMENT_REFUNDED → reverte appointment.isPaid e marca status REFUNDED.
 *  - PAYMENT_DELETED → marca status DELETED.
 *  - Reconciliação por externalReference quando o payment local sumiu.
 *  - Token inválido → 403.
 *
 * Não usa rede nem banco real. O StatefulSupabase imita a API do client
 * Supabase (.from().select().eq()...) o suficiente pra cobrir os caminhos
 * que o webhook usa.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from './asaas.service';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { AsaasWebhookEvent, AsaasChargeStatus } from './asaas.types';

// ============================================================
// Stateful mock do Supabase (suficiente para o webhook)
// ============================================================
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
        if (op === 'not-is') return r[col] !== val;
        if (op === 'gt') return r[col] > val;
        if (op === 'ilike') {
          // Suporta apenas o padrão '%substr%' (suficiente para os usos do webhook).
          const target = String(val).replace(/^%/, '').replace(/%$/, '').toLowerCase();
          const value = String(r[col] ?? '').toLowerCase();
          return value.includes(target);
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
      select: () => {
        if (mode === 'insert' || mode === 'update') return chain;
        mode = 'select';
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
      delete: () => {
        mode = 'delete';
        return chain;
      },
      eq: (col: string, val: any) => {
        filters.push(['eq', col, val]);
        return chain;
      },
      is: (col: string, val: any) => {
        filters.push(['is', col, val]);
        return chain;
      },
      not: (col: string, _: string, val: any) => {
        filters.push(['not-is', col, val]);
        return chain;
      },
      in: (col: string, vals: any[]) => {
        filters.push(['in', col, vals]);
        return chain;
      },
      ilike: (col: string, val: string) => {
        filters.push(['ilike', col, val]);
        return chain;
      },
      gte: (col: string, v: any) => {
        filters.push(['gte', col, v]);
        return chain;
      },
      lte: (col: string, v: any) => {
        filters.push(['lte', col, v]);
        return chain;
      },
      gt: (col: string, v: any) => {
        filters.push(['gt', col, v]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      single: async () => {
        const rows = applyFilters(tables[table], filters);
        if (rows.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'No rows' } };
        }
        if (rows.length > 1) {
          return { data: null, error: { code: 'PGRST116', message: 'Multiple rows' } };
        }
        return { data: rows[0], error: null };
      },
      maybeSingle: async () => {
        const rows = applyFilters(tables[table], filters);
        if (rows.length === 0) return { data: null, error: null };
        return { data: rows[0], error: null };
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
        const keep = tables[table].filter(
          (r) => !applyFilters([r], filters).length,
        );
        const removed = tables[table].length - keep.length;
        tables[table] = keep;
        return { data: { count: removed }, error: null };
      }
      // select sem terminator → sempre array
      return { data: applyFilters(tables[table], filters), error: null };
    }

    return chain;
  }

  return {
    from: (table: string) => builder(table),
    _state: tables,
  };
}

// ============================================================
// Helpers
// ============================================================
function paymentEvent(event: AsaasWebhookEvent, payment: any) {
  return { event, payment };
}

function basePaymentData(overrides: Partial<any> = {}) {
  return {
    id: 'asaas_pay_001',
    status: 'RECEIVED',
    value: 50.0,
    billingType: 'PIX',
    invoiceUrl: 'https://asaas.com/invoice/001',
    bankSlipUrl: null,
    externalReference: null,
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================
async function buildController(initial: Tables) {
  const sb = createStatefulSupabase(initial);
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [AsaasWebhookController],
    providers: [
      { provide: SupabaseService, useValue: sb },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, dflt?: any) => {
            if (key === 'ASAAS_WEBHOOK_TOKEN') return 'test-token';
            return dflt;
          },
        },
      },
      {
        provide: AsaasService,
        useValue: {
          configured: true,
          cancelCharge: jest.fn(),
        },
      },
    ],
  }).compile();

  const controller = moduleRef.get(AsaasWebhookController);
  return { controller, state: (sb as any)._state as Tables };
}

// ============================================================
// Cenários
// ============================================================
describe('AsaasWebhookController (e2e)', () => {
  describe('PAYMENT_RECEIVED em pagamento de agendamento', () => {
    it('marca isPaid, atualiza order.paymentId e vincula cashRegisterId', async () => {
      const { controller, state } = await buildController({
        appointments: [
          { id: 'appt-1', isPaid: false, status: 'PENDING_PAYMENT' },
        ],
        orders: [
          { id: 'order-1', appointmentId: 'appt-1', status: 'PENDING', paymentId: null },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            asaasStatus: 'PENDING',
            appointmentId: 'appt-1',
            clientId: 'client-1',
            amount: 5000,
            paidAt: null,
            notes: null,
            cashRegisterId: null,
          },
        ],
        cash_registers: [
          { id: 'caixa-1', isOpen: true, date: '2026-05-07' },
        ],
      });

      const result = await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData()),
        'test-token',
      );

      expect(result).toEqual({ received: true });
      expect(state.payments[0].asaasStatus).toBe('RECEIVED');
      expect(state.payments[0].paidAt).not.toBeNull();
      expect(state.payments[0].cashRegisterId).toBe('caixa-1');
      expect(state.appointments[0].isPaid).toBe(true);
      expect(state.appointments[0].status).toBe('SCHEDULED');
      expect(state.orders[0].status).toBe('PAID');
      expect(state.orders[0].paymentId).toBe('pay-local-1');
    });

    it('idempotente: 2 webhooks PAYMENT_RECEIVED não duplicam efeitos', async () => {
      const { controller, state } = await buildController({
        appointments: [
          { id: 'appt-1', isPaid: false, status: 'PENDING_PAYMENT' },
        ],
        orders: [
          { id: 'order-1', appointmentId: 'appt-1', status: 'PENDING', paymentId: null },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            asaasStatus: 'PENDING',
            appointmentId: 'appt-1',
            amount: 5000,
            paidAt: null,
            cashRegisterId: null,
          },
        ],
        cash_registers: [{ id: 'caixa-1', isOpen: true, date: '2026-05-07' }],
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData()),
        'test-token',
      );
      const firstPaidAt = state.payments[0].paidAt;

      // Segunda entrega do mesmo evento
      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData()),
        'test-token',
      );

      expect(state.payments[0].paidAt).toBe(firstPaidAt);
      expect(state.payments).toHaveLength(1);
    });

    it('caixa fechado: paidAt é setado mas cashRegisterId fica NULL', async () => {
      const { controller, state } = await buildController({
        appointments: [{ id: 'appt-1', isPaid: false, status: 'SCHEDULED' }],
        orders: [],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            asaasStatus: 'PENDING',
            appointmentId: 'appt-1',
            amount: 5000,
            paidAt: null,
            cashRegisterId: null,
          },
        ],
        cash_registers: [], // nenhum aberto
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData()),
        'test-token',
      );

      expect(state.payments[0].paidAt).not.toBeNull();
      expect(state.payments[0].cashRegisterId).toBeFalsy();
      expect(state.appointments[0].isPaid).toBe(true);
    });
  });

  describe('PAYMENT_OVERDUE em assinatura', () => {
    it('suspende sub e cria dívida', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          {
            id: 'sub-1',
            clientId: 'client-1',
            status: 'ACTIVE',
            plan: { name: 'Mensal' },
          },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            clientId: 'client-1',
            subscriptionId: 'sub-1',
            amount: 5000,
            asaasStatus: 'PENDING',
          },
        ],
        clients: [{ id: 'client-1', hasDebts: false }],
        debts: [],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_OVERDUE,
          basePaymentData({ status: 'OVERDUE' }),
        ),
        'test-token',
      );

      expect(state.payments[0].asaasStatus).toBe('OVERDUE');
      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
      expect(state.debts).toHaveLength(1);
      expect(state.debts[0].clientId).toBe('client-1');
      expect(state.debts[0].amount).toBe(5000);
      expect(state.debts[0].isSettled).toBe(false);
      // A descrição carrega a tag [asaas:<id>] para correlacionar com o pagamento confirmado depois.
      expect(state.debts[0].description).toContain('[asaas:asaas_pay_001]');
      expect(state.clients[0].hasDebts).toBe(true);
    });

    it('idempotente: OVERDUE duas vezes para a mesma cobrança não duplica a dívida', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          { id: 'sub-1', clientId: 'client-1', status: 'ACTIVE', plan: { name: 'Mensal' } },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            clientId: 'client-1',
            subscriptionId: 'sub-1',
            amount: 5000,
            asaasStatus: 'PENDING',
          },
        ],
        clients: [{ id: 'client-1', hasDebts: false }],
        debts: [],
      });

      const event = paymentEvent(
        AsaasWebhookEvent.PAYMENT_OVERDUE,
        basePaymentData({ status: 'OVERDUE' }),
      );
      await controller.handleWebhook(event, 'test-token');
      await controller.handleWebhook(event, 'test-token');

      expect(state.debts).toHaveLength(1);
    });

    it('PAYMENT_RECEIVED depois de OVERDUE quita a dívida automaticamente', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          { id: 'sub-1', clientId: 'client-1', status: 'ACTIVE', plan: { name: 'Mensal' }, endDate: '2026-06-12T00:00:00.000' },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            clientId: 'client-1',
            subscriptionId: 'sub-1',
            amount: 5000,
            asaasStatus: 'PENDING',
            paidAt: null,
          },
        ],
        clients: [{ id: 'client-1', hasDebts: false }],
        debts: [],
        cash_registers: [],
      });

      // 1. Cobrança vence → cria dívida tagueada
      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_OVERDUE, basePaymentData({ status: 'OVERDUE' })),
        'test-token',
      );
      expect(state.debts).toHaveLength(1);
      expect(state.debts[0].isSettled).toBe(false);

      // 2. Cliente paga → mesma cobrança confirma → dívida correlata deve ser quitada
      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({ status: 'RECEIVED' })),
        'test-token',
      );

      expect(state.debts[0].isSettled).toBe(true);
      expect(state.debts[0].remainingBalance).toBe(0);
      expect(state.clients[0].hasDebts).toBe(false);
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
    });
  });

  describe('PAYMENT_REFUNDED', () => {
    it('reverte appointment.isPaid e marca status REFUNDED', async () => {
      const { controller, state } = await buildController({
        appointments: [{ id: 'appt-1', isPaid: true, status: 'SCHEDULED' }],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            appointmentId: 'appt-1',
            asaasStatus: 'RECEIVED',
            paidAt: '2026-05-07T10:00:00.000',
          },
        ],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_REFUNDED,
          basePaymentData({ status: 'REFUNDED' }),
        ),
        'test-token',
      );

      expect(state.payments[0].asaasStatus).toBe(AsaasChargeStatus.REFUNDED);
      expect(state.appointments[0].isPaid).toBe(false);
    });
  });

  describe('PAYMENT_DELETED', () => {
    it('marca status DELETED (não conta no caixa via calculateDailyTotals)', async () => {
      const { controller, state } = await buildController({
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            asaasStatus: 'PENDING',
          },
        ],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_DELETED,
          basePaymentData({ status: 'DELETED' }),
        ),
        'test-token',
      );

      expect(state.payments[0].asaasStatus).toBe('DELETED');
    });
  });

  describe('Reconciliação por externalReference', () => {
    it('webhook RECEIVED sem payment local, mas com externalReference de assinatura existente: recria payment', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          { id: 'sub-1', clientId: 'client-1', status: 'PENDING_PAYMENT', endDate: null },
        ],
        payments: [], // sumiu
        cash_registers: [{ id: 'caixa-1', isOpen: true, date: '2026-05-07' }],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_RECEIVED,
          basePaymentData({
            id: 'asaas_pay_999',
            externalReference: 'sub-1',
            value: 79.9,
          }),
        ),
        'test-token',
      );

      expect(state.payments).toHaveLength(1);
      expect(state.payments[0].asaasPaymentId).toBe('asaas_pay_999');
      expect(state.payments[0].subscriptionId).toBe('sub-1');
      expect(state.payments[0].amount).toBe(7990);
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
    });
  });

  describe('Segurança', () => {
    it('rejeita webhook com token inválido', async () => {
      const { controller } = await buildController({});
      await expect(
        controller.handleWebhook(
          paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData()),
          'wrong-token',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('aceita quando não há token configurado', async () => {
      // ConfigService devolve undefined → controller pula validação
      const sb = createStatefulSupabase({ payments: [] });
      const moduleRef = await Test.createTestingModule({
        controllers: [AsaasWebhookController],
        providers: [
          { provide: SupabaseService, useValue: sb },
          {
            provide: ConfigService,
            useValue: { get: (_: string, dflt?: any) => dflt },
          },
          {
            provide: AsaasService,
            useValue: { configured: false, cancelCharge: jest.fn() },
          },
        ],
      }).compile();
      const ctl = moduleRef.get(AsaasWebhookController);
      const result = await ctl.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData()),
        undefined,
      );
      expect(result).toEqual({ received: true });
    });
  });
});
