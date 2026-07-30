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
import { CashRegisterService } from '../cash-register/cash-register.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from './asaas.service';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { AsaasWebhookEvent, AsaasChargeStatus } from './asaas.types';
import { NotificationsService } from '../notifications/notifications.service';
import { localDateString } from '../common/datetime.util';

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
        if (op === 'lt') return r[col] < val;
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
      lt: (col: string, v: any) => {
        filters.push(['lt', col, v]);
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
async function buildController(initial: Tables, asaasOverrides: Record<string, any> = {}) {
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
          ...asaasOverrides,
        },
      },
      // CashRegisterService real ligado ao mesmo Supabase stateful, para que o
      // vínculo de pagamento ao caixa (linkPaymentToBusinessDateRegister) seja
      // exercitado de verdade nos testes que checam cashRegisterId.
      {
        provide: CashRegisterService,
        useValue: new CashRegisterService(sb as any),
      },
      {
        provide: NotificationsService,
        useValue: { notifySubscriptionOverdue: jest.fn().mockResolvedValue(undefined) },
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
        // scheduledAt casa com a date do caixa: a venda contabiliza no caixa do
        // DIA DO ATENDIMENTO (regra businessDate), nao no dia da confirmacao.
        appointments: [
          { id: 'appt-1', isPaid: false, status: 'PENDING_PAYMENT', scheduledAt: '2026-05-07T15:00:00' },
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
      expect(state.payments[0].businessDate).toBe('2026-05-07T00:00:00');
      expect(state.payments[0].cashRegisterId).toBe('caixa-1');
      expect(state.appointments[0].isPaid).toBe(true);
      expect(state.appointments[0].status).toBe('SCHEDULED');
      expect(state.orders[0].status).toBe('PAID');
      expect(state.orders[0].paymentId).toBe('pay-local-1');
    });

    it('assinatura (sem agendamento): businessDate = dia REAL do pagamento (confirmedDate), não hoje', async () => {
      // Regressão: webhook atrasado/reprocessado de assinatura jogava a venda no
      // caixa do dia em que o webhook chegou (now), inflando o faturamento do dia
      // errado. Deve usar a data real informada pelo Asaas (confirmedDate).
      const { controller, state } = await buildController({
        payments: [
          {
            id: 'pay-sub-1',
            asaasPaymentId: 'asaas_pay_sub',
            asaasStatus: 'PENDING',
            appointmentId: null, // assinatura: sem agendamento
            subscriptionId: 'sub-1',
            clientId: 'client-1',
            amount: 7000,
            paidAt: null,
            businessDate: null,
            cashRegisterId: null,
          },
        ],
        cash_registers: [{ id: 'caixa-antigo', isOpen: false, date: '2026-05-20' }],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_RECEIVED,
          basePaymentData({
            id: 'asaas_pay_sub',
            value: 70.0,
            confirmedDate: '2026-05-20',
          }),
        ),
        'test-token',
      );

      // Contabiliza no DIA REAL do pagamento (2026-05-20), não no dia do webhook.
      expect(state.payments[0].businessDate).toBe('2026-05-20T00:00:00');
      expect(String(state.payments[0].paidAt).substring(0, 10)).toBe('2026-05-20');
    });

    it('idempotente: 2 webhooks PAYMENT_RECEIVED não duplicam efeitos', async () => {
      const { controller, state } = await buildController({
        appointments: [
          { id: 'appt-1', isPaid: false, status: 'PENDING_PAYMENT', scheduledAt: '2026-05-07T15:00:00' },
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

    // ============================================================
    // Cobrança órfã de ciclo já superado (casos Murilo Correa / Gustavo /
    // Emanuel, 07/2026): pagou no balcão → confirmação manual renovou o
    // vencimento → a fatura daquele ciclo continuou aberta no Asaas e venceu →
    // o webhook suspendia a assinatura PAGA e criava dívida-fantasma → o app
    // cobrava de novo → cliente pagava 2x, todo mês.
    // ============================================================
    it('cobrança de ciclo JÁ SUPERADO (mensalidade paga no balcão): não suspende, não cria dívida e cancela a órfã', async () => {
      const cancelCharge = jest.fn().mockResolvedValue({ deleted: true });
      const { controller, state } = await buildController(
        {
          client_subscriptions: [
            {
              id: 'sub-1',
              clientId: 'client-1',
              status: 'ACTIVE',
              // pagou no balcão em 15/07 → confirmação manual renovou até 15/08
              endDate: '2026-08-15T20:20:27.018',
              startDate: '2026-07-15T20:20:27.018',
              plan: { name: 'Mensal' },
            },
          ],
          payments: [
            {
              id: 'pay-local-1',
              asaasPaymentId: 'asaas_pay_001',
              clientId: 'client-1',
              subscriptionId: 'sub-1',
              amount: 7000,
              asaasStatus: 'PENDING',
            },
          ],
          clients: [{ id: 'client-1', hasDebts: false }],
          debts: [],
        },
        { cancelCharge },
      );

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_OVERDUE,
          // fatura do ciclo que venceu em 15/07 — anterior ao vencimento vigente
          basePaymentData({ status: 'OVERDUE', dueDate: '2026-07-15', value: 70 }),
        ),
        'test-token',
      );

      // assinatura paga continua ATIVA e sem dívida-fantasma
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(state.debts).toHaveLength(0);
      expect(state.clients[0].hasDebts).toBe(false);
      // e a cobrança órfã é cancelada no gateway (senão o Asaas segue cobrando)
      expect(cancelCharge).toHaveBeenCalledWith('asaas_pay_001');
      expect(state.payments[0].asaasStatus).toBe('CANCELED');
    });

    it('evento OVERDUE SEM dueDate no corpo: busca no Asaas e ainda assim protege a assinatura paga', async () => {
      // O guard depende de dueDate; o corpo do webhook é `any` e um evento sem o
      // campo faria o guard não disparar em silêncio (voltando a suspender quem pagou).
      const cancelCharge = jest.fn().mockResolvedValue({ deleted: true });
      const getCharge = jest.fn().mockResolvedValue({ id: 'asaas_pay_001', status: 'OVERDUE', dueDate: '2026-07-15' });
      const { controller, state } = await buildController(
        {
          client_subscriptions: [
            {
              id: 'sub-1',
              clientId: 'client-1',
              status: 'ACTIVE',
              endDate: '2026-08-15T20:20:27.018',
              startDate: '2026-07-15T20:20:27.018',
              plan: { name: 'Mensal' },
            },
          ],
          payments: [
            {
              id: 'pay-local-1',
              asaasPaymentId: 'asaas_pay_001',
              clientId: 'client-1',
              subscriptionId: 'sub-1',
              amount: 7000,
              asaasStatus: 'PENDING',
            },
          ],
          clients: [{ id: 'client-1', hasDebts: false }],
          debts: [],
        },
        { cancelCharge, getCharge },
      );

      const semDueDate = basePaymentData({ status: 'OVERDUE', value: 70 });
      delete (semDueDate as any).dueDate;

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_OVERDUE, semDueDate),
        'test-token',
      );

      expect(getCharge).toHaveBeenCalledWith('asaas_pay_001');
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(state.debts).toHaveLength(0);
      expect(cancelCharge).toHaveBeenCalledWith('asaas_pay_001');
    });

    it('vencimento no MESMO dia da fatura (não pagou): suspende normalmente — o guard não afrouxa a inadimplência real', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          {
            id: 'sub-1',
            clientId: 'client-1',
            status: 'ACTIVE',
            // ciclo vigente vence justamente nesta fatura → inadimplência legítima
            endDate: '2026-07-15T20:20:27.018',
            startDate: '2026-06-15T20:20:27.018',
            plan: { name: 'Mensal' },
          },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            clientId: 'client-1',
            subscriptionId: 'sub-1',
            amount: 7000,
            asaasStatus: 'PENDING',
          },
        ],
        clients: [{ id: 'client-1', hasDebts: false }],
        debts: [],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_OVERDUE,
          basePaymentData({ status: 'OVERDUE', dueDate: '2026-07-15', value: 70 }),
        ),
        'test-token',
      );

      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
      expect(state.debts).toHaveLength(1);
      expect(state.clients[0].hasDebts).toBe(true);
    });

    it('PENDING_PAYMENT com endDate provisório futuro: suspende (endDate da criação não é prova de renovação)', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          {
            id: 'sub-1',
            clientId: 'client-1',
            status: 'PENDING_PAYMENT',
            // endDate provisório da criação (nunca houve pagamento)
            endDate: '2026-08-15T00:00:00',
            startDate: '2026-07-15T00:00:00',
            plan: { name: 'Mensal' },
          },
        ],
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            clientId: 'client-1',
            subscriptionId: 'sub-1',
            amount: 7000,
            asaasStatus: 'PENDING',
          },
        ],
        clients: [{ id: 'client-1', hasDebts: false }],
        debts: [],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_OVERDUE,
          basePaymentData({ status: 'OVERDUE', dueDate: '2026-07-15', value: 70 }),
        ),
        'test-token',
      );

      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
      expect(state.debts).toHaveLength(1);
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

  describe('handlePaymentConfirmed — vencimento: quita ciclo corrente vs renova próximo', () => {
    it('cobrança de RECUPERAÇÃO do ciclo vigente (ACTIVE, ciclo em aberto): quita e MANTÉM o vencimento e os cortes', async () => {
      // Caso do dono: assinatura renovou no sistema mas o mês corrente não foi pago.
      // Disparamos a cobrança do ciclo; quando o cliente paga, deve apenas marcar o
      // ciclo como pago — sem empurrar o vencimento +1 mês (senão paga 1, ganha 2).
      const { controller, state } = await buildController({
        client_subscriptions: [
          {
            id: 'sub-1',
            clientId: 'client-1',
            status: 'ACTIVE',
            startDate: '2027-12-01T00:00:00.000',
            createdAt: '2027-12-01T00:00:00.000',
            endDate: '2027-12-31T00:00:00.000',
            cutsUsedThisMonth: 2,
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
            paidAt: null,
          },
        ],
        clients: [{ id: 'client-1', hasDebts: false }],
        debts: [],
        cash_registers: [],
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({ status: 'RECEIVED' })),
        'test-token',
      );

      const sub = state.client_subscriptions[0];
      expect(sub.status).toBe('ACTIVE');
      expect(sub.endDate).toBe('2027-12-31T00:00:00.000'); // vencimento INALTERADO
      expect(sub.cutsUsedThisMonth).toBe(2); // cortes NÃO zerados (mesmo ciclo)
      expect(state.payments[0].paidAt).toBeTruthy(); // ciclo agora consta pago
    });

    it('renovação do PRÓXIMO ciclo (ACTIVE, ciclo atual já pago por outro pagamento): avança vencimento +1 mês e zera cortes', async () => {
      const { controller, state } = await buildController({
        client_subscriptions: [
          {
            id: 'sub-1',
            clientId: 'client-1',
            status: 'ACTIVE',
            startDate: '2027-12-01T00:00:00.000',
            createdAt: '2027-12-01T00:00:00.000',
            endDate: '2027-12-31T00:00:00.000',
            cutsUsedThisMonth: 3,
            plan: { name: 'Mensal' },
          },
        ],
        payments: [
          // Pagamento do ciclo VIGENTE (já cobre o mês corrente).
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            clientId: 'client-1',
            subscriptionId: 'sub-1',
            amount: 5000,
            asaasStatus: 'CONFIRMED',
            paidAt: '2027-12-15T00:00:00.000',
          },
          // Nova cobrança (próximo ciclo) que está sendo confirmada agora.
          {
            id: 'pay-local-2',
            asaasPaymentId: 'asaas_pay_002',
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

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_RECEIVED,
          basePaymentData({ id: 'asaas_pay_002', status: 'RECEIVED' }),
        ),
        'test-token',
      );

      const sub = state.client_subscriptions[0];
      expect(sub.status).toBe('ACTIVE');
      expect(sub.endDate.startsWith('2028-01-31')).toBe(true); // 12-31 + 1 mês
      expect(sub.cutsUsedThisMonth).toBe(0); // ciclo novo → cortes zerados
    });
  });

  describe('handlePaymentConfirmed — renova só com cobrança liquidada (Asaas como fonte da verdade)', () => {
    it('NÃO ativa a assinatura quando a cobrança real (getCharge) ainda está PENDING, mesmo recebendo PAYMENT_CONFIRMED', async () => {
      const { controller, state } = await buildController(
        {
          client_subscriptions: [
            { id: 'sub-1', clientId: 'client-1', status: 'SUSPENDED', endDate: '2026-06-01T00:00:00.000', plan: { name: 'Mensal' } },
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
          cash_registers: [],
        },
        { getCharge: async () => ({ id: 'asaas_pay_001', status: 'PENDING', value: 50 }) },
      );

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_CONFIRMED, basePaymentData({ status: 'CONFIRMED' })),
        'test-token',
      );

      // Cobrança não liquidada de verdade → assinatura NÃO renova/ativa e nada entra no caixa.
      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
      expect(state.payments[0].paidAt).toBeFalsy();
    });

    it('ativa a assinatura quando getCharge confirma a liquidação (CONFIRMED)', async () => {
      const { controller, state } = await buildController(
        {
          client_subscriptions: [
            { id: 'sub-1', clientId: 'client-1', status: 'SUSPENDED', endDate: '2026-06-01T00:00:00.000', plan: { name: 'Mensal' } },
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
          cash_registers: [],
        },
        { getCharge: async () => ({ id: 'asaas_pay_001', status: 'CONFIRMED', value: 50 }) },
      );

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_CONFIRMED, basePaymentData({ status: 'CONFIRMED' })),
        'test-token',
      );

      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(state.payments[0].paidAt).toBeTruthy();
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

    it('caixa JÁ FECHADO: estorno recalcula totalRevenue e tira a receita fantasma', async () => {
      // Bug relatado pelo dono: "só retornei o PIX pro cliente e entrou como
      // faturamento no caixa de hoje". O caixa fechado guarda os totais na coluna;
      // sem recalcular, o valor estornado fica preso. O estorno deve recalcular o
      // caixa do dia contábil e zerar a receita daquele pagamento.
      const { controller, state } = await buildController({
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            appointmentId: null,
            subscriptionId: 'sub-1',
            asaasStatus: 'RECEIVED',
            method: 'PIX',
            amount: 7000,
            paidAt: '2026-05-07T10:00:00.000',
            businessDate: '2026-05-07T00:00:00',
            cashRegisterId: 'caixa-1',
          },
        ],
        client_subscriptions: [{ id: 'sub-1', status: 'ACTIVE' }],
        cash_registers: [
          {
            id: 'caixa-1',
            isOpen: false, // FECHADO: totais persistidos
            date: '2026-05-07',
            openingBalance: 0,
            closingBalance: 0,
            totalPix: 7000,
            totalRevenue: 7000,
          },
        ],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_REFUNDED,
          basePaymentData({ status: 'REFUNDED', value: 70.0 }),
        ),
        'test-token',
      );

      expect(state.payments[0].asaasStatus).toBe(AsaasChargeStatus.REFUNDED);
      // O caixa fechado foi recalculado: o pagamento estornado saiu da receita.
      expect(state.cash_registers[0].totalRevenue).toBe(0);
      expect(state.cash_registers[0].totalPix).toBe(0);
    });

    it('estorno de assinatura: suspende o plano (não fica ACTIVE de graça)', async () => {
      const { controller, state } = await buildController({
        payments: [
          {
            id: 'pay-local-1',
            asaasPaymentId: 'asaas_pay_001',
            appointmentId: null,
            subscriptionId: 'sub-1',
            asaasStatus: 'RECEIVED',
            amount: 7000,
            paidAt: '2026-05-07T10:00:00.000',
            businessDate: '2026-05-07T00:00:00',
          },
        ],
        client_subscriptions: [{ id: 'sub-1', status: 'ACTIVE' }],
      });

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_REFUNDED,
          basePaymentData({ status: 'REFUNDED' }),
        ),
        'test-token',
      );

      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
    });

    it('estorno de agendamento: comanda volta a PENDING e desvincula o pagamento', async () => {
      const { controller, state } = await buildController({
        appointments: [{ id: 'appt-1', isPaid: true, status: 'SCHEDULED' }],
        orders: [
          { id: 'order-1', appointmentId: 'appt-1', status: 'PAID', paymentId: 'pay-local-1' },
        ],
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

      expect(state.appointments[0].isPaid).toBe(false);
      expect(state.orders[0].status).toBe('PENDING');
      expect(state.orders[0].paymentId).toBeNull();
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
        // O webhook fallback agora exige um admin para usar como registeredBy
        // (FK NOT NULL pra users.id).
        users: [{ id: 'admin-1', role: 'ADMIN' }],
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

  describe('Reconciliação fallback — não gravar receita sem liquidação (H-B)', () => {
    it('fallback NÃO recria payment (receita fantasma) quando a cobrança real (getCharge) está PENDING', async () => {
      // Cobrança recorrente chega sem payment local. O corpo diz CONFIRMED, mas a
      // cobrança real no Asaas ainda está PENDING. Sem o gate, o fallback inseria um
      // payment com asaasStatus do CORPO (RECEIVED/CONFIRMED) → contava como receita no
      // dashboard/caixa MESMO sem a assinatura renovar (o gate de renovação roda só
      // depois). Resultado: receita fantasma sem pagamento — a classe que o time fechou.
      const { controller, state } = await buildController(
        {
          client_subscriptions: [
            { id: 'sub-1', clientId: 'client-1', status: 'PENDING_PAYMENT', endDate: null },
          ],
          payments: [], // sumiu → cai no fallback
          cash_registers: [{ id: 'caixa-1', isOpen: true, date: '2026-05-07' }],
          users: [{ id: 'admin-1', role: 'ADMIN' }], // fallback exige admin p/ registeredBy
        },
        // Corpo diz CONFIRMED, mas a fonte da verdade (getCharge) está PENDING.
        { getCharge: async () => ({ id: 'asaas_pay_888', status: 'PENDING', value: 79.9 }) },
      );

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_CONFIRMED,
          basePaymentData({
            id: 'asaas_pay_888',
            status: 'CONFIRMED',
            externalReference: 'sub-1',
            value: 79.9,
          }),
        ),
        'test-token',
      );

      // Cobrança não liquidada → nada de payment fantasma, nada de renovação.
      expect(state.payments).toHaveLength(0);
      expect(state.client_subscriptions[0].status).toBe('PENDING_PAYMENT');
    });

    it('fallback de AGENDAMENTO também NÃO recria payment quando a cobrança (getCharge) está PENDING', async () => {
      // Mesma classe de receita fantasma, no ramo irmão (agendamento). Cobrança de
      // agendamento chega sem payment local; corpo diz CONFIRMED mas getCharge está
      // PENDING → não pode gravar payment (que conta no caixa/dashboard).
      const { controller, state } = await buildController(
        {
          appointments: [
            { id: 'appt-1', clientId: 'client-1', scheduledAt: '2026-05-07T15:00:00', isPaid: false, status: 'PENDING_PAYMENT' },
          ],
          payments: [], // sumiu → cai no fallback de agendamento
          cash_registers: [{ id: 'caixa-1', isOpen: true, date: '2026-05-07' }],
          users: [{ id: 'admin-1', role: 'ADMIN' }],
        },
        { getCharge: async () => ({ id: 'asaas_pay_appt', status: 'PENDING', value: 50 }) },
      );

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_CONFIRMED,
          basePaymentData({
            id: 'asaas_pay_appt',
            status: 'CONFIRMED',
            externalReference: 'appt-1',
            value: 50,
          }),
        ),
        'test-token',
      );

      expect(state.payments).toHaveLength(0);
      expect(state.appointments[0].isPaid).toBe(false);
    });

    it('fallback recria payment normalmente quando a cobrança ESTÁ liquidada (getCharge CONFIRMED)', async () => {
      // Caminho legítimo preservado: cliente pagou de verdade, payment local sumiu
      // (race/falha de DB), getCharge confirma a liquidação → recria e renova.
      const { controller, state } = await buildController(
        {
          client_subscriptions: [
            { id: 'sub-1', clientId: 'client-1', status: 'PENDING_PAYMENT', endDate: null },
          ],
          payments: [],
          cash_registers: [{ id: 'caixa-1', isOpen: true, date: '2026-05-07' }],
          users: [{ id: 'admin-1', role: 'ADMIN' }],
        },
        { getCharge: async () => ({ id: 'asaas_pay_777', status: 'CONFIRMED', value: 79.9 }) },
      );

      await controller.handleWebhook(
        paymentEvent(
          AsaasWebhookEvent.PAYMENT_CONFIRMED,
          basePaymentData({
            id: 'asaas_pay_777',
            status: 'CONFIRMED',
            externalReference: 'sub-1',
            value: 79.9,
          }),
        ),
        'test-token',
      );

      expect(state.payments).toHaveLength(1);
      expect(state.payments[0].asaasPaymentId).toBe('asaas_pay_777');
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
          {
            provide: CashRegisterService,
            useValue: new CashRegisterService(sb as any),
          },
          {
            provide: NotificationsService,
            useValue: { notifySubscriptionOverdue: jest.fn().mockResolvedValue(undefined) },
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

  // ============================================================
  // Pagamento de dívida (Quitação de dívida via PIX do app)
  // ============================================================
  describe('PAYMENT_RECEIVED em pagamento de dívida (DEBT_PAYMENT)', () => {
    function debtTables(overrides: Partial<Tables> = {}): Tables {
      return {
        users: [{ id: 'admin-1', role: 'ADMIN' }],
        clients: [{ id: 'client-1', name: 'Paulo', hasDebts: true }],
        client_subscriptions: [
          {
            id: 'sub-1',
            clientId: 'client-1',
            status: 'SUSPENDED',
            // venceu ontem — pagamento hoje está na carência do dia-âncora
            endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
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
            description: 'Cobrança não paga — Plano Premium (PIX) [sub:sub-1:cycle:2026-07-15]',
          },
        ],
        payments: [],
        cash_registers: [],
        ...overrides,
      };
    }

    const settledCharge = {
      id: 'asaas_pay_debt',
      status: 'RECEIVED',
      value: 140,
      billingType: 'PIX',
      externalReference: 'client-1',
      paymentDate: '2026-07-16',
    };

    it('espelho DEBT_PAYMENT existente: confirma, quita a dívida e REATIVA a assinatura', async () => {
      const { controller, state } = await buildController(
        debtTables({
          payments: [
            {
              id: 'pay-debt-1',
              asaasPaymentId: 'asaas_pay_debt',
              asaasStatus: 'PENDING',
              appointmentId: null,
              subscriptionId: null,
              clientId: 'client-1',
              amount: 14000,
              paidAt: null,
              notes: 'DEBT_PAYMENT',
            },
          ],
        }),
        { getCharge: jest.fn().mockResolvedValue(settledCharge) },
      );

      const result = await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      expect(result).toEqual({ received: true });
      expect(state.payments[0].paidAt).not.toBeNull();
      expect(state.debts[0].isSettled).toBe(true);
      expect(state.debts[0].remainingBalance).toBe(0);
      expect(state.clients[0].hasDebts).toBe(false);
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(state.client_subscriptions[0].cutsUsedThisMonth).toBe(0);
      expect(new Date(state.client_subscriptions[0].endDate).getTime()).toBeGreaterThan(Date.now());
      // payment VINCULADO à assinatura reativada — sem isso isCurrentCyclePaid
      // (que filtra por subscriptionId) seguia "ciclo não pago" e o admin
      // confirmava manualmente de novo (payment duplicado — caso Roger 22/07).
      expect(state.payments[0].subscriptionId).toBe('sub-1');
    });

    it('SEM espelho local (insert falhou na geração do QR): fallback por externalReference=clientId recria DEBT_PAYMENT e baixa tudo (caso Paulo Sergio 16/07/2026)', async () => {
      const { controller, state } = await buildController(
        debtTables(), // payments vazio: o espelho nunca foi criado
        { getCharge: jest.fn().mockResolvedValue(settledCharge) },
      );

      const result = await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      expect(result).toEqual({ received: true });
      // espelho recriado com o marcador DEBT_PAYMENT e registrante-sistema
      expect(state.payments).toHaveLength(1);
      expect(state.payments[0].notes).toBe('DEBT_PAYMENT');
      expect(state.payments[0].registeredBy).toBe('admin-1');
      expect(state.payments[0].clientId).toBe('client-1');
      expect(state.payments[0].amount).toBe(14000);
      expect(state.payments[0].paidAt).not.toBeNull();
      expect(state.payments[0].businessDate).toBe('2026-07-16T00:00:00');
      // e a baixa completa aconteceu
      expect(state.debts[0].isSettled).toBe(true);
      expect(state.clients[0].hasDebts).toBe(false);
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(state.payments[0].subscriptionId).toBe('sub-1');
    });

    it('assinatura JÁ ACTIVE (reentrega/webhook atrasado): quita a dívida e vincula o payment pela tag [sub:...]', async () => {
      // Reativação já aconteceu por outra via, mas a dívida ficou aberta e o
      // espelho sem vínculo — a baixa deve quitar e vincular mesmo sem reativar.
      const subUuid = '11111111-2222-4333-8444-555555555555';
      const tables = debtTables();
      tables.client_subscriptions[0].id = subUuid;
      tables.client_subscriptions[0].status = 'ACTIVE';
      tables.client_subscriptions[0].endDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      // a tag [sub:...] só carrega UUID de verdade (regex do parse é estrita)
      tables.debts[0].description = `Cobrança não paga — Plano Premium (PIX) [sub:${subUuid}:cycle:2026-07-15]`;
      const { controller, state } = await buildController(tables, {
        getCharge: jest.fn().mockResolvedValue(settledCharge),
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      expect(state.debts[0].isSettled).toBe(true);
      expect(state.clients[0].hasDebts).toBe(false);
      expect(state.payments[0].subscriptionId).toBe(subUuid); // via tag da dívida
    });

    it('fallback de dívida NÃO grava nada se a cobrança não está liquidada no Asaas (evento forjado/mal-classificado)', async () => {
      const { controller, state } = await buildController(
        debtTables(),
        { getCharge: jest.fn().mockResolvedValue({ ...settledCharge, status: 'PENDING' }) },
      );

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
        })),
        'test-token',
      );

      expect(state.payments).toHaveLength(0);
      expect(state.debts[0].isSettled).toBe(false);
      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
      expect(state.clients[0].hasDebts).toBe(true);
    });

    it('pagamento que NÃO cobre o total pendente não quita nem reativa', async () => {
      const tables = debtTables();
      tables.debts.push({
        id: 'debt-2',
        clientId: 'client-1',
        amount: 5000,
        remainingBalance: 5000,
        isSettled: false,
        description: 'Comanda em aberto',
      });
      const { controller, state } = await buildController(tables, {
        getCharge: jest.fn().mockResolvedValue(settledCharge),
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140, // 14000 < 19000 pendentes
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      // o espelho é recriado (dinheiro real recebido), mas a baixa é abortada
      expect(state.payments).toHaveLength(1);
      expect(state.debts.every((d: any) => d.isSettled === false)).toBe(true);
      expect(state.client_subscriptions[0].status).toBe('SUSPENDED');
    });

    it('reativação cancela a fatura OVERDUE da recorrência do ciclo quitado e PRESERVA a do próximo ciclo (caso Leandro Belo 30/07/2026)', async () => {
      const tables = debtTables();
      tables.client_subscriptions[0].asaasSubscriptionId = 'sub_rec1';
      const paidCycleEndDay = String(tables.client_subscriptions[0].endDate).substring(0, 10);
      tables.payments = [
        {
          id: 'pay-debt-1',
          asaasPaymentId: 'asaas_pay_debt',
          asaasStatus: 'PENDING',
          appointmentId: null,
          subscriptionId: null,
          clientId: 'client-1',
          amount: 14000,
          paidAt: null,
          notes: 'DEBT_PAYMENT',
        },
        // espelho local da fatura vencida (criado pelo webhook OVERDUE)
        {
          id: 'pay-mirror-1',
          asaasPaymentId: 'ch_overdue',
          asaasStatus: 'OVERDUE',
          appointmentId: null,
          subscriptionId: 'sub-1',
          clientId: 'client-1',
          amount: 14000,
          paidAt: null,
          notes: 'Cobrança recorrente vencida (cobrança ch_overdue)',
        },
      ];
      const cancelCharge = jest.fn().mockResolvedValue({});
      const updateSubscription = jest.fn().mockResolvedValue({});
      const getSubscriptionPayments = jest.fn().mockResolvedValue([
        // fatura do ciclo que a dívida cobrava — redundante, morre
        { id: 'ch_overdue', status: 'OVERDUE', dueDate: paidCycleEndDay, deleted: false },
        // fatura do próximo ciclo — legítima, sobrevive
        { id: 'ch_next', status: 'PENDING', dueDate: '2099-01-01', deleted: false },
        // fatura antiga já paga — nunca tocar
        { id: 'ch_paid', status: 'RECEIVED', dueDate: paidCycleEndDay, paymentDate: paidCycleEndDay },
      ]);
      const { controller, state } = await buildController(tables, {
        getCharge: jest.fn().mockResolvedValue(settledCharge),
        cancelCharge,
        updateSubscription,
        getSubscriptionPayments,
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      // baixa completa continua valendo
      expect(state.debts[0].isSettled).toBe(true);
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      // só a fatura redundante foi cancelada; a do próximo ciclo sobreviveu
      expect(cancelCharge).toHaveBeenCalledTimes(1);
      expect(cancelCharge).toHaveBeenCalledWith('ch_overdue');
      // espelho local deixa de constar pendente
      const mirror = state.payments.find((p: any) => p.id === 'pay-mirror-1');
      expect(mirror.asaasStatus).toBe('CANCELED');
      // pagou na carência → dia-âncora preservado → recorrência já está alinhada
      expect(updateSubscription).not.toHaveBeenCalled();
    });

    it('quitação além da carência (dia-âncora move): cancela a fatura deslocada do meio do ciclo e realinha o nextDueDate da recorrência (casos Gustavo Parreira / Gabriel Marra 30/07/2026)', async () => {
      const tables = debtTables();
      tables.client_subscriptions[0].asaasSubscriptionId = 'sub_rec1';
      // venceu 15 dias atrás — além da carência de 7d → novo ciclo começa hoje
      tables.client_subscriptions[0].endDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const paidCycleEndDay = String(tables.client_subscriptions[0].endDate).substring(0, 10);
      // a recorrência já gerou a fatura do mês seguinte NO DIA ANTIGO — que agora
      // cai no meio do novo ciclo (hoje → hoje+1 mês) e cobraria o ciclo pago
      const driftedDueDay = localDateString(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));
      const cancelCharge = jest.fn().mockResolvedValue({});
      const updateSubscription = jest.fn().mockResolvedValue({});
      const getSubscriptionPayments = jest.fn().mockResolvedValue([
        { id: 'ch_overdue', status: 'OVERDUE', dueDate: paidCycleEndDay, deleted: false },
        { id: 'ch_drift', status: 'PENDING', dueDate: driftedDueDay, deleted: false },
      ]);
      const { controller, state } = await buildController(tables, {
        getCharge: jest.fn().mockResolvedValue(settledCharge),
        cancelCharge,
        updateSubscription,
        getSubscriptionPayments,
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(cancelCharge).toHaveBeenCalledWith('ch_overdue');
      expect(cancelCharge).toHaveBeenCalledWith('ch_drift');
      // recorrência realinhada ao fim do NOVO ciclo (senão a fatura renasce no
      // dia antigo todo mês, no meio do ciclo pago)
      const newCycleEndDay = localDateString(new Date(state.client_subscriptions[0].endDate));
      expect(updateSubscription).toHaveBeenCalledTimes(1);
      expect(updateSubscription).toHaveBeenCalledWith('sub_rec1', { nextDueDate: newCycleEndDay });
    });

    it('falha na limpeza de faturas NÃO desfaz a quitação nem a reativação', async () => {
      const tables = debtTables();
      tables.client_subscriptions[0].asaasSubscriptionId = 'sub_rec1';
      const cancelCharge = jest.fn();
      const { controller, state } = await buildController(tables, {
        getCharge: jest.fn().mockResolvedValue(settledCharge),
        cancelCharge,
        updateSubscription: jest.fn(),
        getSubscriptionPayments: jest.fn().mockRejectedValue(new Error('asaas fora do ar')),
      });

      await controller.handleWebhook(
        paymentEvent(AsaasWebhookEvent.PAYMENT_RECEIVED, basePaymentData({
          id: 'asaas_pay_debt',
          value: 140,
          externalReference: 'client-1',
          paymentDate: '2026-07-16',
        })),
        'test-token',
      );

      expect(state.debts[0].isSettled).toBe(true);
      expect(state.clients[0].hasDebts).toBe(false);
      expect(state.client_subscriptions[0].status).toBe('ACTIVE');
      expect(cancelCharge).not.toHaveBeenCalled();
    });
  });
});
