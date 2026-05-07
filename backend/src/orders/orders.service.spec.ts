import { OrdersService } from './orders.service';

// ============================================================================
// Smoke test ponta-a-ponta de OrdersService.create + addItem + cancel + removeItem.
// Cobre o fluxo de consumo de cortes da assinatura (plano com override 100%).
//
// Os 6 cenários que o usuário precisa garantir antes de subir para produção:
//
//   1. Cliente sem assinatura ACTIVE → cobra preço cheio.
//   2. Plano "Corte 100% off, 2 cortes/mês", saldo=2, 1 corte → R$ 0 + débito.
//   3. Plano "Corte 100% off, 2 cortes/mês", saldo=2, 3 cortes → 2x R$ 0 + 1x cheio
//      (3ª unidade ultrapassa limite e cai no fallback global).
//   4. Plano "Corte 100% off, 2 cortes/mês", saldo já zerado → cobra cheio.
//   5. Plano global 30% (sem override), serviço fora do plano → aplica 30%, sem débito.
//   6. removeItem em item com consumedSubscriptionCut=true → devolve 1 crédito.
// ============================================================================

interface SeedSubscription {
  id: string;
  cutsUsedThisMonth: number;
  plan: {
    id: string;
    cutsPerMonth: number;
    discountPercent: number;
    services: { serviceId: string; discountPercent: number }[];
  };
}

/**
 * Mock simplificado do SupabaseService que cobre as queries usadas por OrdersService.
 * Mantém estado em memória — a cada `create`/`addItem`/`removeItem`/`cancel` o estado
 * evolui igual ao banco real teria evoluído.
 */
function makeSupabaseMock(opts: {
  subscription: SeedSubscription | null;
  services: { id: string; price: number }[];
  products?: { id: string; salePrice: number }[];
}) {
  const products = opts.products ?? [];
  // Estado mutável (banco em memória):
  const sub = opts.subscription ? { ...opts.subscription } : null;
  let nextOrder: any = null;
  const orderItems: any[] = [];
  const orders: any[] = [];

  const rpcCalls: { fn: string; args: any }[] = [];

  /**
   * Builder genérico para encadeamentos `from(table).select(...).eq(...).maybeSingle()`.
   * Em vez de tentar simular o Supabase em toda a sua glória, cada teste constrói o
   * cenário e o builder devolve o que o caller espera.
   */
  function from(table: string) {
    const ctx: any = {
      _table: table,
      _filters: [] as Array<{ col: string; val: any }>,
      _select: '',
      _action: 'select' as 'select' | 'insert' | 'update' | 'delete',
      _payload: undefined as any,
    };

    const chain: any = {
      select(sel: string) {
        ctx._select = sel;
        return chain;
      },
      insert(payload: any) {
        ctx._action = 'insert';
        ctx._payload = payload;
        return chain;
      },
      update(payload: any) {
        ctx._action = 'update';
        ctx._payload = payload;
        return chain;
      },
      delete() {
        ctx._action = 'delete';
        return chain;
      },
      eq(col: string, val: any) {
        ctx._filters.push({ col, val });
        return chain;
      },
      neq() { return chain; },
      lte() { return chain; },
      gte() { return chain; },
      ilike() { return chain; },
      in() { return chain; },
      is() { return chain; },
      not() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      single: async () => resolve(ctx, true),
      maybeSingle: async () => resolve(ctx, false),
      // Para selects sem .single() — retorno como `.then(resolver)`. Implementamos
      // como thenable, comum em código Supabase: `await query`.
      then: (resolveFn: any) => Promise.resolve(resolve(ctx, false)).then(resolveFn),
    };

    return chain;
  }

  function resolve(ctx: any, requireRow: boolean): any {
    const filters = Object.fromEntries(ctx._filters.map((f: any) => [f.col, f.val]));

    // ── INSERT ──────────────────────────────────────────────────────────────
    if (ctx._action === 'insert') {
      if (ctx._table === 'orders') {
        const row = { ...ctx._payload };
        nextOrder = row;
        orders.push(row);
        return { data: row, error: null };
      }
      if (ctx._table === 'order_items') {
        // Aceita um único item (todas as chamadas em OrdersService inserem um por vez)
        orderItems.push({ ...ctx._payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (ctx._action === 'update') {
      if (ctx._table === 'orders') {
        const target = orders.find((o) => o.id === filters.id);
        if (target) Object.assign(target, ctx._payload);
        return { data: target, error: null };
      }
      if (ctx._table === 'client_subscriptions') {
        if (sub && sub.id === filters.id) {
          if (typeof ctx._payload.cutsUsedThisMonth === 'number') {
            sub.cutsUsedThisMonth = ctx._payload.cutsUsedThisMonth;
          }
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (ctx._action === 'delete') {
      if (ctx._table === 'order_items') {
        const idx = orderItems.findIndex((i) => i.id === filters.id);
        if (idx >= 0) orderItems.splice(idx, 1);
      }
      return { data: null, error: null };
    }

    // ── SELECT ──────────────────────────────────────────────────────────────
    if (ctx._table === 'client_subscriptions') {
      if (!sub) return { data: null, error: null };
      // Mock simplificado: o teste só usa um cliente por cenário, então qualquer
      // clientId/id devolve a única assinatura semeada.
      // Suporta select por clientId+status (getActiveClientSubscription) ou por id (debit/refund fallback).
      if (filters.status && filters.status !== 'ACTIVE') return { data: null, error: null };
      const row = {
        id: sub.id,
        cutsUsedThisMonth: sub.cutsUsedThisMonth,
        plan: { ...sub.plan },
      };
      return { data: row, error: null };
    }
    if (ctx._table === 'promotions') {
      // sem promoções ativas para simplificar — testes de promoção rodam em outro spec
      return { data: [], error: null };
    }
    if (ctx._table === 'services') {
      const row = opts.services.find((s) => s.id === filters.id) ?? null;
      return { data: row, error: row ? null : { message: 'not found' } };
    }
    if (ctx._table === 'products') {
      const row = products.find((p) => p.id === filters.id) ?? null;
      return { data: row, error: row ? null : { message: 'not found' } };
    }
    if (ctx._table === 'orders') {
      const target = orders.find((o) => o.id === filters.id || o.appointmentId === filters.appointmentId);
      if (!target) return { data: null, error: requireRow ? { message: 'not found' } : null };
      // Adicionar items embedded para findOne
      const items = orderItems.filter((i) => i.orderId === target.id);
      return { data: { ...target, items, client: null, consumerProfessional: null }, error: null };
    }
    if (ctx._table === 'order_items') {
      const target = orderItems.find((i) => i.id === filters.id);
      return { data: target ?? null, error: target ? null : { message: 'not found' } };
    }
    if (ctx._table === 'cash_registers') {
      return { data: null, error: null };
    }
    if (ctx._table === 'appointments') {
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  const supabase: any = {
    from,
    rpc: jest.fn((fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      // Aplica o efeito da RPC no estado em memória (espelha o que a função
      // PostgreSQL faria atomicamente em produção).
      if (sub && args && args.sub_id === sub.id && typeof args.amount === 'number') {
        if (fn === 'debit_subscription_cuts') {
          sub.cutsUsedThisMonth = (sub.cutsUsedThisMonth || 0) + args.amount;
        } else if (fn === 'refund_subscription_cuts') {
          sub.cutsUsedThisMonth = Math.max(0, (sub.cutsUsedThisMonth || 0) - args.amount);
        }
      }
      return Promise.resolve({ data: null, error: null });
    }),
    // Helpers de inspeção para os testes:
    _state: () => ({ sub, orders, orderItems, rpcCalls, nextOrder }),
  };
  return supabase;
}

function makeService(supabase: any) {
  // OrdersService usa AsaasService, StockService, ProfessionalDebtsService — só
  // pra create/addItem/removeItem/cancel não precisamos chamar nada deles.
  const noop = {} as any;
  const svc = new OrdersService(supabase, noop, noop, noop);
  // Silencia logs durante os testes
  (svc as any).logger = { log: () => {}, error: () => {}, warn: () => {} };
  return svc;
}

const SVC_CORTE = 'svc-corte';
const SVC_BARBA = 'svc-barba';

const SERVICES = [
  { id: SVC_CORTE, price: 5000 }, // R$ 50
  { id: SVC_BARBA, price: 3000 }, // R$ 30
];

// ============================================================================

describe('OrdersService — consumo natural de cortes da assinatura', () => {
  it('1) Cliente SEM assinatura ACTIVE → cobra preço cheio', async () => {
    const supabase = makeSupabaseMock({ subscription: null, services: SERVICES });
    const svc = makeService(supabase);

    await svc.create({
      clientId: 'client-1',
      items: [
        { serviceId: SVC_CORTE, quantity: 1, unitPrice: 5000, itemType: 'SERVICE' },
      ],
    });

    const { orders, orderItems, rpcCalls } = supabase._state();
    expect(orders[0].totalAmount).toBe(5000);
    expect(orderItems[0].unitPrice).toBe(5000);
    expect(orderItems[0].consumedSubscriptionCut).toBe(false);
    expect(rpcCalls.length).toBe(0); // nenhum débito
  });

  it('2) Plano com Corte 100% off + saldo disponível → R$ 0 + débito de 1 corte', async () => {
    const supabase = makeSupabaseMock({
      subscription: {
        id: 'sub-1',
        cutsUsedThisMonth: 0,
        plan: {
          id: 'plan-1',
          cutsPerMonth: 2,
          discountPercent: 0,
          services: [{ serviceId: SVC_CORTE, discountPercent: 100 }],
        },
      },
      services: SERVICES,
    });
    const svc = makeService(supabase);

    await svc.create({
      clientId: 'client-1',
      items: [
        { serviceId: SVC_CORTE, quantity: 1, unitPrice: 5000, itemType: 'SERVICE' },
      ],
    });

    const { sub, orders, orderItems, rpcCalls } = supabase._state();
    expect(orders[0].totalAmount).toBe(0);
    expect(orderItems[0].unitPrice).toBe(0);
    expect(orderItems[0].consumedSubscriptionCut).toBe(true);
    // Debitou 1 corte via RPC
    expect(rpcCalls).toEqual([
      { fn: 'debit_subscription_cuts', args: { sub_id: 'sub-1', amount: 1 } },
    ]);
    expect(sub.cutsUsedThisMonth).toBe(1);
  });

  it('3) Quantity > saldo: parte zera, parte cobra (item dividido em sub-linhas)', async () => {
    const supabase = makeSupabaseMock({
      subscription: {
        id: 'sub-1',
        cutsUsedThisMonth: 0,
        plan: {
          id: 'plan-1',
          cutsPerMonth: 2,
          discountPercent: 0, // sem global → 3ª unidade cobra cheio
          services: [{ serviceId: SVC_CORTE, discountPercent: 100 }],
        },
      },
      services: SERVICES,
    });
    const svc = makeService(supabase);

    await svc.create({
      clientId: 'client-1',
      items: [
        { serviceId: SVC_CORTE, quantity: 3, unitPrice: 5000, itemType: 'SERVICE' },
      ],
    });

    const { sub, orders, orderItems } = supabase._state();
    // 3 sub-linhas: 2x R$ 0 + 1x R$ 50 = R$ 50
    expect(orderItems.length).toBe(3);
    const consumedCount = orderItems.filter((i: any) => i.consumedSubscriptionCut).length;
    const cobradoCount = orderItems.filter((i: any) => !i.consumedSubscriptionCut).length;
    expect(consumedCount).toBe(2);
    expect(cobradoCount).toBe(1);
    expect(orders[0].totalAmount).toBe(5000); // só a 3ª unidade cobrou
    expect(sub.cutsUsedThisMonth).toBe(2); // saldo zerado
  });

  it('4) Saldo já zerado → cobra preço cheio (sem débito)', async () => {
    const supabase = makeSupabaseMock({
      subscription: {
        id: 'sub-1',
        cutsUsedThisMonth: 2, // limite atingido
        plan: {
          id: 'plan-1',
          cutsPerMonth: 2,
          discountPercent: 0,
          services: [{ serviceId: SVC_CORTE, discountPercent: 100 }],
        },
      },
      services: SERVICES,
    });
    const svc = makeService(supabase);

    await svc.create({
      clientId: 'client-1',
      items: [
        { serviceId: SVC_CORTE, quantity: 1, unitPrice: 5000, itemType: 'SERVICE' },
      ],
    });

    const { sub, orders, orderItems, rpcCalls } = supabase._state();
    expect(orders[0].totalAmount).toBe(5000);
    expect(orderItems[0].consumedSubscriptionCut).toBe(false);
    expect(rpcCalls.length).toBe(0);
    expect(sub.cutsUsedThisMonth).toBe(2); // não mexeu
  });

  it('5) Plano global 30% sem override → aplica 30% off, sem débito', async () => {
    const supabase = makeSupabaseMock({
      subscription: {
        id: 'sub-1',
        cutsUsedThisMonth: 0,
        plan: {
          id: 'plan-1',
          cutsPerMonth: 99, // ilimitado
          discountPercent: 30,
          services: [], // sem overrides
        },
      },
      services: SERVICES,
    });
    const svc = makeService(supabase);

    await svc.create({
      clientId: 'client-1',
      items: [
        { serviceId: SVC_BARBA, quantity: 1, unitPrice: 3000, itemType: 'SERVICE' },
      ],
    });

    const { sub, orders, orderItems, rpcCalls } = supabase._state();
    // 30% off em R$ 30 = R$ 21
    expect(orderItems[0].unitPrice).toBe(2100);
    expect(orderItems[0].consumedSubscriptionCut).toBe(false);
    expect(orders[0].totalAmount).toBe(2100);
    expect(rpcCalls.length).toBe(0);
    expect(sub.cutsUsedThisMonth).toBe(0);
  });

  it('6) removeItem em item com consumedSubscriptionCut=true → devolve 1 crédito', async () => {
    const supabase = makeSupabaseMock({
      subscription: {
        id: 'sub-1',
        cutsUsedThisMonth: 0,
        plan: {
          id: 'plan-1',
          cutsPerMonth: 2,
          discountPercent: 0,
          services: [{ serviceId: SVC_CORTE, discountPercent: 100 }],
        },
      },
      services: SERVICES,
    });
    const svc = makeService(supabase);

    // Cria comanda que consome 1 corte
    const order = await svc.create({
      clientId: 'client-1',
      items: [
        { serviceId: SVC_CORTE, quantity: 1, unitPrice: 5000, itemType: 'SERVICE' },
      ],
    });

    let { sub } = supabase._state();
    expect(sub.cutsUsedThisMonth).toBe(1);

    // Remove o item
    const itemId = (order as any).items[0].id;
    await svc.removeItem((order as any).id, itemId);

    sub = supabase._state().sub;
    expect(sub.cutsUsedThisMonth).toBe(0); // devolveu

    const { rpcCalls } = supabase._state();
    expect(rpcCalls).toEqual([
      { fn: 'debit_subscription_cuts', args: { sub_id: 'sub-1', amount: 1 } },
      { fn: 'refund_subscription_cuts', args: { sub_id: 'sub-1', amount: 1 } },
    ]);
  });

  it('addItem em comanda existente respeita o saldo atual e debita corretamente', async () => {
    const supabase = makeSupabaseMock({
      subscription: {
        id: 'sub-1',
        cutsUsedThisMonth: 0,
        plan: {
          id: 'plan-1',
          cutsPerMonth: 2,
          discountPercent: 0,
          services: [{ serviceId: SVC_CORTE, discountPercent: 100 }],
        },
      },
      services: SERVICES,
    });
    const svc = makeService(supabase);

    const order = await svc.create({ clientId: 'client-1' });
    expect(supabase._state().sub.cutsUsedThisMonth).toBe(0);

    // 1º Corte adicionado → consome 1
    await svc.addItem((order as any).id, {
      serviceId: SVC_CORTE,
      quantity: 1,
      unitPrice: 5000,
      itemType: 'SERVICE',
    });
    expect(supabase._state().sub.cutsUsedThisMonth).toBe(1);

    // 2º Corte adicionado → consome o último
    await svc.addItem((order as any).id, {
      serviceId: SVC_CORTE,
      quantity: 1,
      unitPrice: 5000,
      itemType: 'SERVICE',
    });
    expect(supabase._state().sub.cutsUsedThisMonth).toBe(2);

    // 3º Corte → saldo esgotou, cobra cheio
    await svc.addItem((order as any).id, {
      serviceId: SVC_CORTE,
      quantity: 1,
      unitPrice: 5000,
      itemType: 'SERVICE',
    });
    expect(supabase._state().sub.cutsUsedThisMonth).toBe(2); // não mexeu
    const { orderItems } = supabase._state();
    const lastItem = orderItems[orderItems.length - 1];
    expect(lastItem.unitPrice).toBe(5000);
    expect(lastItem.consumedSubscriptionCut).toBe(false);
  });
});
