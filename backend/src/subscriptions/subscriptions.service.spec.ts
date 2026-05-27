import { SubscriptionsService } from './subscriptions.service';

// ============================================================================
// Smoke test do changePlan (troca de plano).
//
// Cobre os 5 cenarios que precisamos garantir antes de subir pra producao:
//
//   1. Upgrade (preco do plano novo > atual)
//      -> retorna kind='IMMEDIATE'
//      -> reseta o ciclo (cutsUsedThisMonth=0, novo startDate/endDate)
//      -> troca planId
//      -> seta status PENDING_PAYMENT (Asaas configurado) ou ACTIVE (sem Asaas)
//      -> limpa pendingPlanId e canceledAt
//
//   2. Downgrade (preco menor)
//      -> retorna kind='SCHEDULED'
//      -> NAO mexe no planId, startDate, endDate, cutsUsedThisMonth
//      -> seta pendingPlanId
//
//   3. Lateral (mesmo preco)
//      -> mesmo comportamento de downgrade (SCHEDULED)
//
//   4. Plano igual ao atual
//      -> lanca BadRequestException
//
//   5. Plano novo inativo
//      -> lanca NotFoundException
// ============================================================================

interface SeedSubscription {
  id: string;
  clientId: string;
  status: string;
  planId: string;
  endDate: string;
  asaasSubscriptionId?: string | null;
  plan: { id: string; price: number; name: string; cutsPerMonth: number };
}

interface SeedPlan {
  id: string;
  price: number;
  name: string;
  cutsPerMonth: number;
  isActive: boolean;
}

function makeSupabaseMock(opts: {
  subscription: SeedSubscription;
  plans: SeedPlan[];
}) {
  let sub: any = { ...opts.subscription };
  const plans = opts.plans;
  const updates: any[] = []; // historico de updates aplicados em client_subscriptions

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
      neq() {
        return chain;
      },
      gte() {
        return chain;
      },
      lte() {
        return chain;
      },
      lt() {
        return chain;
      },
      gt() {
        return chain;
      },
      in() {
        return chain;
      },
      is() {
        return chain;
      },
      not() {
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      async maybeSingle() {
        return chain._resolveOne();
      },
      async single() {
        return chain._resolveOne();
      },
      then(onFulfilled: any) {
        return Promise.resolve(chain._resolveAll()).then(onFulfilled);
      },
      _resolveOne() {
        if (ctx._table === 'client_subscriptions') {
          if (ctx._action === 'update') {
            sub = { ...sub, ...ctx._payload };
            updates.push({ ...ctx._payload });
            return { data: { ...sub }, error: null };
          }
          if (ctx._action === 'select') {
            return { data: { ...sub }, error: null };
          }
        }
        if (ctx._table === 'subscription_plans' && ctx._action === 'select') {
          const idFilter = ctx._filters.find((f: any) => f.col === 'id');
          const plan = plans.find((p) => p.id === idFilter?.val);
          if (!plan) return { data: null, error: { code: 'PGRST116' } };
          return { data: plan, error: null };
        }
        if (ctx._table === 'clients' && ctx._action === 'select') {
          return {
            data: { id: sub.clientId, asaasCustomerId: 'cus_mock', cpf: '00000000000', name: 'Cliente Mock' },
            error: null,
          };
        }
        if (ctx._table === 'payments') {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      _resolveAll() {
        if (ctx._table === 'client_subscriptions') {
          if (ctx._action === 'update') {
            sub = { ...sub, ...ctx._payload };
            updates.push({ ...ctx._payload });
            return { data: null, error: null };
          }
          if (ctx._action === 'select') {
            return { data: [sub], error: null };
          }
        }
        return { data: [], error: null };
      },
    };
    return chain;
  }

  return { from, getSub: () => sub, getUpdates: () => updates };
}

function makeService(mock: ReturnType<typeof makeSupabaseMock>, asaasConfigured = false) {
  const asaas = {
    configured: asaasConfigured,
    cancelSubscription: jest.fn().mockResolvedValue(undefined),
    createCharge: jest.fn().mockResolvedValue({
      id: 'chg_new',
      invoiceUrl: 'https://invoice',
      status: 'PENDING',
      bankSlipUrl: null,
    }),
    getPixQrCode: jest.fn().mockResolvedValue({ encodedImage: 'qr', payload: 'pix' }),
    findCustomerByExternalReference: jest.fn().mockResolvedValue({ id: 'cus_mock' }),
    centavosToReais: (c: number) => c / 100,
  };
  const config = { get: (_k: string, def: any) => def };
  const debtsService = {} as any;
  const mailService = {} as any;
  const service: any = new (SubscriptionsService as any)(
    mock as any,
    asaas,
    config,
    debtsService,
    mailService,
  );
  // findClientSubscription faz join complexo; vamos stubbar para devolver o sub atual.
  service.findClientSubscription = jest.fn(async () => {
    const sub = mock.getSub();
    return {
      ...sub,
      asaasSubscriptionId: sub.asaasSubscriptionId,
      plan: sub.plan,
    };
  });
  return { service, asaas };
}

describe('SubscriptionsService.changePlan', () => {
  const baseSub: SeedSubscription = {
    id: 'sub_1',
    clientId: 'client_1',
    status: 'ACTIVE',
    planId: 'plan_basic',
    endDate: '2099-12-31T00:00:00Z',
    asaasSubscriptionId: 'asaas_sub_1',
    plan: { id: 'plan_basic', price: 5000, name: 'Basic', cutsPerMonth: 2 },
  };

  const plans: SeedPlan[] = [
    { id: 'plan_basic', price: 5000, name: 'Basic', cutsPerMonth: 2, isActive: true },
    { id: 'plan_gold', price: 10000, name: 'Gold', cutsPerMonth: 5, isActive: true },
    { id: 'plan_cheap', price: 3000, name: 'Cheap', cutsPerMonth: 1, isActive: true },
    { id: 'plan_lateral', price: 5000, name: 'Lateral', cutsPerMonth: 3, isActive: true },
    { id: 'plan_off', price: 4000, name: 'Off', cutsPerMonth: 1, isActive: false },
  ];

  test('upgrade: retorna IMMEDIATE, reseta ciclo e troca planId (sem Asaas)', async () => {
    const mock = makeSupabaseMock({ subscription: { ...baseSub }, plans });
    const { service } = makeService(mock, false);

    const result = await service.changePlan('client_1', { newPlanId: 'plan_gold' });

    expect(result.kind).toBe('IMMEDIATE');
    const lastUpdate = mock.getUpdates().at(-1)!;
    expect(lastUpdate.planId).toBe('plan_gold');
    expect(lastUpdate.cutsUsedThisMonth).toBe(0);
    expect(lastUpdate.canceledAt).toBeNull();
    expect(lastUpdate.pendingPlanId).toBeNull();
    expect(lastUpdate.status).toBe('ACTIVE'); // sem Asaas, ativa direto
  });

  test('upgrade com Asaas: status fica PENDING_PAYMENT e gera cobranca', async () => {
    const mock = makeSupabaseMock({ subscription: { ...baseSub }, plans });
    const { service, asaas } = makeService(mock, true);

    const result = await service.changePlan('client_1', { newPlanId: 'plan_gold', billingType: 'PIX' });

    expect(result.kind).toBe('IMMEDIATE');
    expect(result.charge).toBeTruthy();
    expect(result.charge.id).toBe('chg_new');
    const updateFromTroca = mock.getUpdates().find((u: any) => u.planId === 'plan_gold');
    expect(updateFromTroca?.status).toBe('PENDING_PAYMENT');
    expect(asaas.cancelSubscription).toHaveBeenCalledWith('asaas_sub_1');
    expect(asaas.createCharge).toHaveBeenCalled();
  });

  test('downgrade: retorna SCHEDULED e seta pendingPlanId, sem mexer no ciclo', async () => {
    const mock = makeSupabaseMock({ subscription: { ...baseSub }, plans });
    const { service } = makeService(mock, false);

    const result = await service.changePlan('client_1', { newPlanId: 'plan_cheap' });

    expect(result.kind).toBe('SCHEDULED');
    const sub = mock.getSub();
    expect(sub.planId).toBe('plan_basic'); // ainda nao mudou
    expect(sub.pendingPlanId).toBe('plan_cheap'); // agendado
    // nao reseta ciclo
    expect(mock.getUpdates().every((u: any) => u.cutsUsedThisMonth === undefined)).toBe(true);
  });

  test('lateral (mesmo preco): trata como downgrade -> SCHEDULED', async () => {
    const mock = makeSupabaseMock({ subscription: { ...baseSub }, plans });
    const { service } = makeService(mock, false);

    const result = await service.changePlan('client_1', { newPlanId: 'plan_lateral' });

    expect(result.kind).toBe('SCHEDULED');
    expect(mock.getSub().pendingPlanId).toBe('plan_lateral');
  });

  test('plano igual ao atual: lanca erro', async () => {
    const mock = makeSupabaseMock({ subscription: { ...baseSub }, plans });
    const { service } = makeService(mock, false);

    await expect(
      service.changePlan('client_1', { newPlanId: 'plan_basic' }),
    ).rejects.toThrow('O plano novo é igual ao plano atual');
  });

  test('plano inativo: lanca erro', async () => {
    const mock = makeSupabaseMock({ subscription: { ...baseSub }, plans });
    const { service } = makeService(mock, false);

    await expect(
      service.changePlan('client_1', { newPlanId: 'plan_off' }),
    ).rejects.toThrow('Plano novo não encontrado ou inativo');
  });

  test('subscription nao ACTIVE: lanca erro', async () => {
    const mock = makeSupabaseMock({
      subscription: { ...baseSub, status: 'PENDING_PAYMENT' },
      plans,
    });
    const { service } = makeService(mock, false);

    await expect(
      service.changePlan('client_1', { newPlanId: 'plan_gold' }),
    ).rejects.toThrow('Só é possível trocar de plano em assinaturas ativas');
  });
});
