import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { nowLocalIsoString, resolveBusinessDate } from '../common/datetime.util';
import { isCurrentCyclePaid, subscriptionCycleFloorMs } from '../common/pricing.helper';
import { isRevenuePayment } from '../common/business-date.helper';
import { AsaasService } from '../asaas/asaas.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import {
  AsaasBillingType,
  AsaasSubscriptionCycle,
  AsaasCharge,
  AsaasCreditCard,
  AsaasCreditCardHolderInfo,
  asaasBillingToLocalPaymentMethod,
  parseAsaasBillingType,
} from '../asaas/asaas.types';
import {
  CreatePlanDto,
  UpdatePlanDto,
  SubscribeClientDto,
  SubscribeMeDto,
  ReactivateMeDto,
  GrantCourtesyDto,
} from './dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  /**
   * Janela de recência (dias) para incluir assinaturas SUSPENDED na reconciliação
   * automática com o Asaas. Cobre o cliente que paga a renovação com atraso; churn
   * antigo fica de fora p/ não pesar as chamadas ao Asaas a cada 10 min.
   */
  private static readonly RECONCILE_SUSPENDED_WINDOW_DAYS = 40;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
    private readonly configService: ConfigService,
    private readonly cashRegisterService: CashRegisterService,
  ) {}

  // SUBSCRIPTION PLANS

  /**
   * Substitui completamente a lista de serviços com desconto específico de um plano.
   * Aceita array vazio (limpa todos) ou undefined (não mexe).
   */
  private async syncPlanServices(
    planId: string,
    services: { serviceId: string; discountPercent: number }[] | undefined,
  ) {
    if (services === undefined) return;

    await this.supabase
      .from('subscription_plan_services')
      .delete()
      .eq('planId', planId);

    if (services.length === 0) return;

    const dedup = new Map<string, number>();
    for (const s of services) dedup.set(s.serviceId, s.discountPercent);

    const rows = Array.from(dedup.entries()).map(([serviceId, discountPercent]) => ({
      id: randomUUID(),
      planId,
      serviceId,
      discountPercent,
      createdAt: nowLocalIsoString(),
    }));

    const { error } = await this.supabase
      .from('subscription_plan_services')
      .insert(rows);

    if (error) {
      this.logger.error(`Falha ao sincronizar serviços do plano ${planId}: ${JSON.stringify(error)}`);
      throw new BadRequestException(
        `Erro ao salvar serviços do plano: ${(error as { message?: string }).message || 'desconhecido'}`,
      );
    }
  }

  /**
   * Anexa lista de serviços (com nome/preço) a um plano carregado.
   */
  private async attachPlanServices(plan: any) {
    if (!plan?.id) return plan;
    const { data: rows } = await this.supabase
      .from('subscription_plan_services')
      .select('id, serviceId, discountPercent, service:services(id, name, price)')
      .eq('planId', plan.id);
    return { ...plan, services: rows || [] };
  }

  async createPlan(dto: CreatePlanDto) {
    const now = nowLocalIsoString();
    const { data: existing } = await this.supabase
      .from('subscription_plans')
      .select('id')
      .ilike('name', dto.name)
      .eq('isActive', true)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Já existe um plano ativo com este nome');
    }

    const { data: plan, error } = await this.supabase
      .from('subscription_plans')
      .insert({
        id: randomUUID(),
        name: dto.name,
        description: dto.description,
        price: dto.price,
        cutsPerMonth: dto.cutsPerMonth,
        discountPercent: dto.discountPercent ?? 0,
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    await this.syncPlanServices(plan.id, dto.services);

    return this.attachPlanServices(plan);
  }

  async findAllPlans(activeOnly: boolean = true) {
    let queryBuilder = this.supabase
      .from('subscription_plans')
      .select('*, subscriptions:client_subscriptions!planId(id), services:subscription_plan_services(id, serviceId, discountPercent, service:services(id, name, price))')
      .order('displayOrder', { ascending: true })
      .order('price', { ascending: true });

    if (activeOnly) {
      queryBuilder = queryBuilder.eq('isActive', true);
    }

    const { data: plans, error } = await queryBuilder;

    if (error) throw error;
    return (plans || []).map((plan: any) => ({
      ...plan,
      _count: { subscriptions: plan.subscriptions?.length ?? 0 },
      subscriptions: undefined,
    }));
  }

  async findOnePlan(id: string) {
    const { data: plan, error } = await this.supabase
      .from('subscription_plans')
      .select('*, services:subscription_plan_services(id, serviceId, discountPercent, service:services(id, name, price))')
      .eq('id', id)
      .single();

    if (error || !plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const { data: plan, error: findError } = await this.supabase
      .from('subscription_plans')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    const updateData: any = {};
    if (dto.name !== undefined) {
      const { data: existing } = await this.supabase
        .from('subscription_plans')
        .select('id')
        .ilike('name', dto.name)
        .eq('isActive', true)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new BadRequestException('Já existe outro plano ativo com este nome');
      }
      updateData.name = dto.name;
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.cutsPerMonth !== undefined) updateData.cutsPerMonth = dto.cutsPerMonth;
    if (dto.discountPercent !== undefined) updateData.discountPercent = dto.discountPercent;
    if (dto.displayOrder !== undefined) updateData.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const { data: updated, error } = await this.supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    await this.syncPlanServices(id, dto.services);

    return this.attachPlanServices(updated);
  }

  async findPlan(id: string) {
    return this.findOnePlan(id);
  }

  async removePlan(id: string) {
    return this.deletePlan(id);
  }

  async deletePlan(id: string) {
    const { data: plan, error: findError } = await this.supabase
      .from('subscription_plans')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    const { error } = await this.supabase
      .from('subscription_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Obtém ou cria um customer no Asaas para o cliente.
   * Se o asaasCustomerId salvo no banco for inválido (ex: sandbox vs produção),
   * recria o customer automaticamente.
   */
  private async ensureAsaasCustomer(clientId: string): Promise<string> {
    const { data: clientData } = await this.supabase
      .from('clients')
      .select('asaasCustomerId, name, email, phone, cpf')
      .eq('id', clientId)
      .single();

    if (!clientData) {
      throw new BadRequestException('Cliente não encontrado');
    }

    // Se já tem asaasCustomerId, verificar se é válido no ambiente atual
    if (clientData.asaasCustomerId) {
      try {
        await this.asaasService.findCustomerByExternalReference(clientId);
        return clientData.asaasCustomerId;
      } catch {
        this.logger.warn(
          `asaasCustomerId ${clientData.asaasCustomerId} inválido para cliente ${clientId} (provável troca de ambiente). Recriando...`,
        );
        // Limpa o ID inválido e recria abaixo
        await this.supabase
          .from('clients')
          .update({ asaasCustomerId: null })
          .eq('id', clientId);
      }
    }

    // Criar novo customer no Asaas
    if (!clientData.cpf) {
      throw new BadRequestException(
        'CPF é obrigatório para gerar cobranças. Atualize seu perfil com um CPF válido.',
      );
    }

    const asaasCustomer = await this.asaasService.createCustomer({
      name: clientData.name,
      email: clientData.email || undefined,
      cpfCnpj: clientData.cpf,
      mobilePhone: clientData.phone || undefined,
      externalReference: clientId,
    });

    await this.supabase
      .from('clients')
      .update({ asaasCustomerId: asaasCustomer.id })
      .eq('id', clientId);

    this.logger.log(`Customer Asaas criado: ${asaasCustomer.id} para cliente ${clientId}`);
    return asaasCustomer.id;
  }

  // CLIENT SUBSCRIPTIONS

  /**
   * payments.registeredBy é NOT NULL e FK → users.id. Os fluxos de assinatura
   * (cliente no app, confirmação manual, reconciliação, regeneração de PIX) não têm
   * um admin no contexto. Antes passavam o clientId (id da tabela `clients`, NÃO
   * `users`) → violava a FK e o insert do pagamento falhava em silêncio: a
   * assinatura ativava mas NENHUM payment era gravado/vinculado (por isso o histórico
   * tem assinaturas sem pagamento e pagamentos sem subscriptionId). Usa o primeiro
   * ADMIN como "registrante sistema", mesmo padrão do webhook e do cash-register.
   */
  private async resolveSystemRegisteredBy(): Promise<string> {
    const { data: admin } = await this.supabase
      .from('users')
      .select('id')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();
    if (!(admin as any)?.id) {
      throw new BadRequestException(
        'Nenhum usuário ADMIN encontrado para registrar o pagamento (registeredBy).',
      );
    }
    return (admin as any).id;
  }

  async subscribeClient(dto: SubscribeClientDto) {
    // Verificar se cliente existe
    const { data: client } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', dto.clientId)
      .single();

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Verificar se plano existe
    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('id, cutsPerMonth, price, name')
      .eq('id', dto.planId)
      .eq('isActive', true)
      .single();

    if (!plan) {
      throw new NotFoundException('Plano não encontrado ou inativo');
    }

    // Verificar se já tem assinatura ativa (excluindo canceladas e suspensas)
    const { data: existingSubscriptions } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('clientId', dto.clientId)
      .neq('status', 'CANCELED')
      .neq('status', 'SUSPENDED')
      .limit(1);

    if (existingSubscriptions && existingSubscriptions.length > 0) {
      throw new BadRequestException('Cliente já possui uma assinatura ativa ou aguardando pagamento');
    }

    // Criar assinatura
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Pagamento no balcão (admin já recebeu dinheiro/PIX/cartão na mão): ativa na
    // hora, sem cobrança Asaas. É o fluxo "renovei hoje → caiu no caixa de hoje".
    // Sem paymentMethod: fluxo online, nasce PENDING_PAYMENT (gera cobrança).
    //
    // Assinatura NUNCA nasce ATIVA sem pagamento — só vira ACTIVE aqui porque o
    // dinheiro está sendo lançado no caixa logo abaixo. Antes, quando o Asaas não
    // estava configurado, nascia 'ACTIVE' de graça (caso Kleudson): isso continua
    // proibido — sem paymentMethod, fica PENDING_PAYMENT.
    const paidAtBalcao = !!dto.paymentMethod;
    const initialStatus = paidAtBalcao ? 'ACTIVE' : 'PENDING_PAYMENT';
    const subNow = nowLocalIsoString();

    // Tenta encontrar uma assinatura cancelada para reutilizar o registro (devido à restrição UNIQUE no clientId)
    const { data: existingSub } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('clientId', dto.clientId)
      .limit(1)
      .single();

    // Quando ativa no balcão, o ciclo de cortes começa agora (lastResetDate).
    const lastResetDate = paidAtBalcao ? subNow : undefined;

    let query;
    if (existingSub) {
      this.logger.log(`Atualizando assinatura existente ${existingSub.id} para cliente ${dto.clientId}`);
      query = this.supabase
        .from('client_subscriptions')
        .update({
          planId: dto.planId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          cutsUsedThisMonth: 0,
          status: initialStatus,
          ...(lastResetDate ? { lastResetDate } : {}),
          // Reativacao: limpa canceledAt para nao parecer "cancelado pendente"
          canceledAt: null,
          updatedAt: subNow,
        })
        .eq('id', existingSub.id);
    } else {
      query = this.supabase
        .from('client_subscriptions')
        .insert({
          id: randomUUID(),
          clientId: dto.clientId,
          planId: dto.planId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          cutsUsedThisMonth: 0,
          status: initialStatus,
          ...(lastResetDate ? { lastResetDate } : {}),
          createdAt: subNow,
          updatedAt: subNow,
        });
    }

    const { data: insertedSub, error } = await query.select('*').single();

    if (error) {
      this.logger.error(`client_subscriptions insert failed: ${JSON.stringify(error)}`);
      const msg = (error as { message?: string }).message || 'Erro ao criar assinatura';
      const enumHint =
        msg.includes('invalid input value for enum') ||
        msg.includes('PENDING_PAYMENT') ||
        msg.includes('SUSPENDED')
          ? ' Aplique no PostgreSQL o script backend/sql/alter_subscription_status_enum.sql (valores PENDING_PAYMENT e SUSPENDED).'
          : '';
      throw new BadRequestException(`${msg}${enumHint}`);
    }

    // Re-fetch com relações (fallback se o select com join falhar)
    const { data: subscription, error: refetchError } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('id', insertedSub.id)
      .single();

    if (refetchError) {
      this.logger.warn(`Re-fetch assinatura com joins falhou: ${refetchError.message}`);
    }
    let resolved = subscription;
    if (!resolved) {
      const { data: minimal } = await this.supabase
        .from('client_subscriptions')
        .select('*')
        .eq('id', insertedSub.id)
        .single();
      resolved = minimal ? { ...minimal, plan } : null;
    }

    // Pagamento no balcão: lança no caixa do dia agora. A assinatura já nasceu
    // ACTIVE acima; aqui o dinheiro entra no faturamento de hoje (idêntico ao que
    // confirmPaymentManually faz). Sem isso, ativaríamos uma assinatura "de graça".
    if (paidAtBalcao) {
      await this.recordBalcaoSubscriptionPayment(
        {
          id: insertedSub.id,
          clientId: dto.clientId,
          amount: plan.price ?? 0,
          planName: plan.name ?? '',
        },
        dto.paymentMethod as string,
        subNow,
        'Assinatura paga no balcão',
      );
    }

    return resolved;
  }

  async subscribe(dto: SubscribeClientDto) {
    return this.subscribeClient(dto);
  }

  /**
   * Concede uma assinatura a um cliente: o admin "dá" o plano até a data escolhida
   * (limite de 1 mês). Nasce ACTIVE. Duas variantes, conforme `paymentMethod`:
   *
   * - SEM paymentMethod → CORTESIA grátis: isComp=true, NÃO registra pagamento, NÃO
   *   gera cobrança Asaas, NÃO entra em caixa/conciliação/receita/pote. Ao vencer
   *   vira EXPIRED sem dívida (os pontos de suspensão respeitam isComp).
   * - COM paymentMethod → 1ª mensalidade CONTABILIZADA no caixa (recordBalcao, como
   *   receita pelo método) e isComp=false: comporta-se como assinatura paga normal
   *   (ao vencer, SUSPENDED + inadimplência).
   *
   * As renovações seguintes são pagas/contabilizadas pelo fluxo normal. Só admin.
   */
  async grantCourtesy(dto: GrantCourtesyDto) {
    const { data: client } = await this.supabase
      .from('clients')
      .select('id, isActive')
      .eq('id', dto.clientId)
      .single();
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.isActive === false) {
      throw new BadRequestException('Cliente inativo não pode receber assinatura');
    }

    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('id, name, cutsPerMonth, price')
      .eq('id', dto.planId)
      .eq('isActive', true)
      .single();
    if (!plan) throw new NotFoundException('Plano não encontrado ou inativo');

    // Término: precisa ser futuro e no máximo 1 mês a partir de hoje.
    const now = new Date();
    const endDate = new Date(dto.endDate);
    if (Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Data de término inválida');
    }
    if (endDate <= now) {
      throw new BadRequestException('A data de término deve ser futura');
    }
    const maxEnd = new Date(now);
    maxEnd.setMonth(maxEnd.getMonth() + 1);
    // Tolerância de 1 dia para não barrar o usuário que escolhe exatamente o limite
    // (comparação por dia, ignorando hora).
    if (endDate.getTime() > maxEnd.getTime() + 24 * 60 * 60 * 1000) {
      throw new BadRequestException('A cortesia tem limite de 1 mês');
    }

    // Dedup: não conceder se o cliente já tem assinatura viva (ACTIVE/PENDING).
    // EXPIRED/SUSPENDED/CANCELED são reaproveitadas (constraint UNIQUE no clientId).
    const { data: live } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('clientId', dto.clientId)
      .in('status', ['ACTIVE', 'PENDING_PAYMENT'])
      .limit(1);
    if (live && live.length > 0) {
      throw new BadRequestException(
        'Cliente já possui uma assinatura ativa ou aguardando pagamento',
      );
    }

    // Contabilizar no caixa? Com paymentMethod a 1ª mensalidade vira receita e a
    // assinatura é tratada como paga (isComp=false). Sem método, é cortesia grátis.
    const accountInCash = !!dto.paymentMethod;
    const subNow = nowLocalIsoString();
    const fields = {
      planId: dto.planId,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      cutsUsedThisMonth: 0,
      lastResetDate: subNow,
      status: 'ACTIVE',
      isComp: !accountInCash,
      canceledAt: null,
      updatedAt: subNow,
    };

    // Reutiliza a linha existente do cliente (UNIQUE clientId), senão cria.
    const { data: existingSub } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('clientId', dto.clientId)
      .limit(1)
      .single();

    let query;
    if (existingSub) {
      query = this.supabase
        .from('client_subscriptions')
        .update(fields)
        .eq('id', existingSub.id);
    } else {
      query = this.supabase.from('client_subscriptions').insert({
        id: randomUUID(),
        clientId: dto.clientId,
        createdAt: subNow,
        ...fields,
      });
    }

    const { data: inserted, error } = await query.select('*').single();
    if (error) {
      this.logger.error(`grantCourtesy insert/update falhou: ${JSON.stringify(error)}`);
      const msg = (error as { message?: string }).message || 'Erro ao conceder assinatura';
      const hint = /isComp/i.test(msg)
        ? ' Aplique no PostgreSQL o script backend/sql/alter_client_subscriptions_add_is_comp.sql.'
        : '';
      throw new BadRequestException(`${msg}${hint}`);
    }

    // Contabilizar a 1ª mensalidade no caixa (entra como receita pelo método).
    // recordBalcaoSubscriptionPayment é idempotente quanto a falha (só loga) e já
    // reseta isComp=false — coerente com "é uma assinatura paga".
    if (accountInCash) {
      await this.recordBalcaoSubscriptionPayment(
        {
          id: inserted.id,
          clientId: dto.clientId,
          amount: plan.price ?? 0,
          planName: plan.name ?? '',
        },
        dto.paymentMethod as string,
        subNow,
        'Assinatura concedida (1ª mensalidade no caixa)',
      );
    }

    this.logger.log(
      `Assinatura ${accountInCash ? 'concedida + contabilizada no caixa' : 'CORTESIA concedida'} (cliente ${dto.clientId}, plano ${plan.name}) até ${endDate.toISOString()}`,
    );

    const { data: subscription } = await this.supabase
      .from('client_subscriptions')
      .select(
        '*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))',
      )
      .eq('id', inserted.id)
      .single();
    return subscription ?? inserted;
  }

  async findSubscription(id: string) {
    const { data: subscription, error } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('id', id)
      .single();

    if (error || !subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    return subscription;
  }

  /**
   * Reconcilia uma assinatura específica e devolve o estado atualizado.
   * Usado pelo endpoint admin POST /subscriptions/:id/sync-asaas.
   */
  async reconcileSubscription(id: string) {
    return this.syncWithAsaas(id);
  }

  async findByClient(clientId: string) {
    return this.findClientSubscription(clientId);
  }

  async getRemainingCuts(id: string) {
    const subscription = await this.findSubscription(id);

    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('cutsPerMonth')
      .eq('id', subscription.planId)
      .single();

    const cutsPerMonth = plan?.cutsPerMonth ?? 0;
    const cutsUsed = subscription.cutsUsedThisMonth ?? 0;
    return { remainingCuts: Math.max(cutsPerMonth - cutsUsed, 0) };
  }

  async findAllSubscriptions(status?: string) {
    let queryBuilder = this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .order('createdAt', { ascending: false });

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: subscriptions, error } = await queryBuilder;

    if (error) throw error;
    return this.attachAdminPaymentInfo((subscriptions || []) as any[]);
  }

  /**
   * Para a tela do admin: anexa a cada assinatura a forma de cobrança da última
   * cobrança (latestPayment.method = PIX/cartão/dinheiro) e um flag `inadimplente`
   * (cliente com dívida de assinatura em aberto OU última cobrança OVERDUE). Assim o
   * admin vê de relance quem deve e por qual meio cobrar — sem depender só do status
   * SUSPENDED, que é sobrecarregado (vencido/estorno/legado/overdue).
   */
  private async attachAdminPaymentInfo(subs: any[]): Promise<any[]> {
    if (!subs || subs.length === 0) return subs || [];
    const subIds = subs.map((s) => s.id).filter(Boolean);
    const clientIds = Array.from(new Set(subs.map((s) => s.clientId).filter(Boolean)));

    // Última cobrança por assinatura (método/status). order/limit no mock são no-op,
    // então escolhemos a mais recente por createdAt em memória. No mesmo batch
    // acumulamos TODOS os paidAt por assinatura para derivar `currentCyclePaid` sem
    // N+1 (mesma lógica de isCurrentCyclePaid, sem query por linha).
    const latestBySub = new Map<string, any>();
    const paidAtsBySub = new Map<string, number[]>();
    if (subIds.length > 0) {
      const { data: pays } = await this.supabase
        .from('payments')
        .select('subscriptionId, method, asaasStatus, paidAt, createdAt, cardLast4, cardBrand')
        .in('subscriptionId', subIds);
      for (const p of (pays || []) as any[]) {
        if (!p.subscriptionId) continue;
        const cur = latestBySub.get(p.subscriptionId);
        if (!cur || String(p.createdAt ?? '') >= String(cur.createdAt ?? '')) {
          latestBySub.set(p.subscriptionId, p);
        }
        // Estornado/cancelado/chargeback NÃO conta p/ currentCyclePaid — espelha
        // isRevenuePayment e a régua de isCurrentCyclePaid (senão a lista mostrava
        // "Em dia" numa assinatura cujo pagamento do ciclo foi estornado).
        if (p.paidAt && isRevenuePayment(p)) {
          const ms = new Date(p.paidAt).getTime();
          if (!Number.isNaN(ms)) {
            const arr = paidAtsBySub.get(p.subscriptionId) ?? [];
            arr.push(ms);
            paidAtsBySub.set(p.subscriptionId, arr);
          }
        }
      }
    }

    // Clientes com dívida de assinatura em aberto ('Cobrança não paga%').
    const delinquentClients = new Set<string>();
    // Clientes com cartão tokenizado salvo → admin pode "Cobrar no cartão" direto.
    const clientsWithCard = new Set<string>();
    if (clientIds.length > 0) {
      const { data: debts } = await this.supabase
        .from('debts')
        .select('clientId')
        .in('clientId', clientIds)
        .eq('isSettled', false)
        .ilike('description', 'Cobrança não paga%');
      for (const d of (debts || []) as any[]) {
        if (d.clientId) delinquentClients.add(d.clientId);
      }

      const { data: cardClients } = await this.supabase
        .from('clients')
        .select('id')
        .in('id', clientIds)
        .not('asaasCreditCardToken', 'is', null);
      for (const c of (cardClients || []) as any[]) {
        if (c.id) clientsWithCard.add(c.id);
      }
    }

    const nowMs = Date.now();

    return subs.map((s) => {
      const lp = latestBySub.get(s.id) || null;
      const latestPayment = lp
        ? {
            method: lp.method ?? null,
            asaasStatus: lp.asaasStatus ?? null,
            paidAt: lp.paidAt ?? null,
            cardLast4: lp.cardLast4 ?? null,
            cardBrand: lp.cardBrand ?? null,
          }
        : null;
      const inadimplente =
        delinquentClients.has(s.clientId) || lp?.asaasStatus === 'OVERDUE';

      // currentCyclePaid: só faz sentido para ACTIVE NÃO vencida. Reproduz
      // isCurrentCyclePaid a partir do batch — piso do ciclo = max(startDate,
      // createdAt) - 1 dia. Vencida (endDate <= agora) → undefined: o cron de
      // expiração ainda não suspendeu, mas não deve mostrar "em dia" (espelha o
      // gate de preço que trata vencida como sem benefício).
      let currentCyclePaid: boolean | undefined = undefined;
      const expired = s.endDate && new Date(s.endDate).getTime() <= nowMs;
      if (s.status === 'ACTIVE' && !expired) {
        // Piso normalizado p/ meia-noite UTC — MESMA régua de isCurrentCyclePaid
        // (subscriptionCycleFloorMs). Sem isto, a lista usava `cycleStart - 1dia` cru e
        // discordava do gate na borda do dia: um pagamento gravado como "YYYY-MM-DD"
        // (00:00 UTC) caía 3h ANTES do piso cru (que carrega a hora do startDate em
        // GMT-3) → "Ciclo não pago" numa assinatura PAGA (casos Roberto/Gustavo Henrique).
        const cycleFloorMs = this.subscriptionCycleFloorMs(s);
        const paidAts = paidAtsBySub.get(s.id) ?? [];
        currentCyclePaid = paidAts.some((ms) => ms >= cycleFloorMs);
      }

      // Status de pagamento consolidado (precedência: OVERDUE > PENDING > PAID).
      let paymentStatus: 'PAID' | 'PENDING' | 'OVERDUE' | null = null;
      if (inadimplente) paymentStatus = 'OVERDUE';
      else if (s.status === 'ACTIVE' && currentCyclePaid !== undefined)
        paymentStatus = currentCyclePaid ? 'PAID' : 'PENDING';

      const hasCardOnFile = clientsWithCard.has(s.clientId);

      return { ...s, latestPayment, inadimplente, currentCyclePaid, paymentStatus, hasCardOnFile };
    });
  }


  async findClientSubscription(clientId: string) {
    // Prioriza assinatura ACTIVE: se existir, sempre retorna a ACTIVE — mesmo
    // que o cliente também tenha uma linha PENDING_PAYMENT mais recente (ex.:
    // tentou renovar e o pagamento não confirmou ainda). Sem essa precedência,
    // o frontend admin mostraria "sem plano" enquanto o backend (que filtra
    // por status='ACTIVE' no pricing.helper) aplicaria desconto — divergência.
    const { data: allSubs } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('clientId', clientId)
      .order('createdAt', { ascending: false });

    const list = (allSubs || []) as any[];
    let subscription: any =
      list.find((s) => s.status === 'ACTIVE') ?? list[0] ?? null;

    // Auto-reconciliação: se está PENDING_PAYMENT e Asaas configurado, tenta sincronizar
    // antes de devolver. Cobre o caso "cliente pagou PIX, Asaas confirmou, webhook falhou".
    if (subscription && subscription.status === 'PENDING_PAYMENT' && this.asaasService.configured) {
      try {
        const synced = await this.syncWithAsaas(subscription.id);
        if (synced && synced.id) subscription = synced;
      } catch (e) {
        this.logger.warn(`[auto-sync] Falha ao reconciliar assinatura ${subscription.id} com Asaas: ${e}`);
      }
    }

    if (subscription) {
      // Buscar última cobrança vinculada a esta assinatura
      const { data: latestPayments } = await this.supabase
        .from('payments')
        .select('*')
        .eq('subscriptionId', subscription.id)
        .order('createdAt', { ascending: false })
        .limit(1);
      
      if (latestPayments?.[0]) {
        subscription.latestPayment = latestPayments[0];
      } else if (subscription.status === 'PENDING_PAYMENT' && subscription.asaasSubscriptionId) {
        // Fallback: buscar última cobrança no Asaas se não houver no banco local (assinaturas legadas)
        try {
          const charges = await this.asaasService.getSubscriptionPayments(subscription.asaasSubscriptionId);
          const pending = charges.find((c: any) => c.status === 'PENDING' || c.status === 'AWAITING_RISK_ANALYSIS') || charges[0];
          if (pending) {
            subscription.latestPayment = {
              asaasPaymentId: pending.id,
              asaasStatus: pending.status,
              invoiceUrl: pending.invoiceUrl,
              method: pending.billingType === 'PIX' ? 'PIX' : 'CARD',
              amount: this.asaasService. centavosToReais(pending.value) * 100, // Volta pra centavos
            };
          }
        } catch (e) {
          this.logger.warn(`Falha ao buscar fallback de pagamento no Asaas para assinatura ${subscription.id}: ${e}`);
        }
      }
    }

    // Auto-suspender se endDate venceu e ainda está ACTIVE
    if (subscription && subscription.status === 'ACTIVE') {
      const endDate = new Date(subscription.endDate);
      if (new Date() > endDate) {
        const now = nowLocalIsoString();
        // Cortesia vencida: EXPIRED sem inadimplência (mesma régua do cron).
        if (subscription.isComp) {
          const { data: expiredSub } = await this.supabase
            .from('client_subscriptions')
            .update({ status: 'EXPIRED', updatedAt: now })
            .eq('id', subscription.id)
            .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
            .single();
          this.logger.log(`Cortesia ${subscription.id} expirada na leitura (sem dívida)`);
          return expiredSub ?? subscription;
        }
        const { data: suspended } = await this.supabase
          .from('client_subscriptions')
          .update({ status: 'SUSPENDED', updatedAt: now })
          .eq('id', subscription.id)
          .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
          .single();
        this.logger.log(`Assinatura ${subscription.id} suspensa automaticamente (endDate ${subscription.endDate} vencido)`);
        // Mesma régua do cron: vencer sem pagamento → registra inadimplência. Cobre o
        // caso em que o CLIENTE abre o app e suspende na leitura antes do cron rodar
        // (o cron filtra status ACTIVE, então não pegaria mais essa assinatura).
        await this.recordSubscriptionDelinquency({
          id: subscription.id,
          clientId: subscription.clientId,
          endDate: subscription.endDate ?? null,
          plan: subscription.plan ?? null,
        }).catch((e) =>
          this.logger.warn(`[auto-suspend] falha ao registrar inadimplência de ${subscription.id}: ${e}`),
        );
        return suspended ?? subscription;
      }
    }

    // Auto-cancelar se PENDING_PAYMENT e endDate já venceu (nunca pagou)
    if (subscription && subscription.status === 'PENDING_PAYMENT') {
      const endDate = new Date(subscription.endDate);
      if (new Date() > endDate) {
        const now = nowLocalIsoString();
        const { data: canceled } = await this.supabase
          .from('client_subscriptions')
          .update({ status: 'CANCELED', updatedAt: now })
          .eq('id', subscription.id)
          .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
          .single();
        this.logger.log(`Assinatura ${subscription.id} cancelada automaticamente (PENDING_PAYMENT expirado, endDate ${subscription.endDate})`);
        return canceled ?? subscription;
      }
    }

    // Espelha o gate do backend de preço (getActiveClientSubscription →
    // isCurrentCyclePaid): o frontend (admin e app do cliente) precisa saber se o
    // CICLO VIGENTE está pago para não mostrar "coberto pelo plano" enquanto a
    // comanda/agendamento cobra cheio. Mesma fonte da verdade (isCurrentCyclePaid
    // varre TODOS os payments) — o front recebe só 1 payment e não reproduz o gate.
    // Só calcula para ACTIVE: status não-ACTIVE já é tratado como sem benefício no
    // front, e os returns antecipados (suspend/cancel acima) não passam por aqui.
    if (subscription && subscription.status === 'ACTIVE') {
      subscription.currentCyclePaid = await isCurrentCyclePaid(this.supabase, subscription);
    }

    return subscription;
  }

  async cancelSubscription(id: string, immediate: boolean = false) {
    const { data: subscription, error: findError } = await this.supabase
      .from('client_subscriptions')
      .select('id, status, asaasSubscriptionId, endDate, clientId')
      .eq('id', id)
      .single();

    if (findError || !subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    if (!['ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED'].includes(subscription.status)) {
      throw new BadRequestException('Assinatura não pode ser cancelada');
    }

    const updated = await this.applyCancellation(subscription, immediate);

    // Anula a dívida-fantasma desta assinatura e limpa hasDebts se não sobrar outra.
    await this.settleSubscriptionDebtsOnCancel((subscription as any).clientId);

    // Cancelar assinatura no Asaas (se vinculada) — para nao cobrar proximo ciclo
    if (this.asaasService.configured && subscription.asaasSubscriptionId) {
      try {
        await this.asaasService.cancelSubscription(subscription.asaasSubscriptionId);
        this.logger.log(`Assinatura Asaas cancelada: ${subscription.asaasSubscriptionId}`);
      } catch (syncError) {
        this.logger.warn(`Falha ao cancelar assinatura no Asaas: ${syncError}`);
      }
    }

    return updated;
  }

  /**
   * Aplica cancelamento. Dois modos:
   *  - lazy (padrao, pro-consumer): se ainda ha tempo de plano (endDate > now),
   *    mantem status ACTIVE com canceledAt setado, cliente continua usando ate vencer.
   *  - immediate=true (admin): forca status=CANCELED na hora, revoga acesso imediatamente.
   *    Usado pra cliente problematico/inadimplente que admin precisa cortar acesso.
   * Se a assinatura ja venceu (endDate < now), o resultado e o mesmo nos dois modos.
   */
  private async applyCancellation(
    subscription: {
      id: string;
      status: string;
      endDate: string | Date | null;
    },
    immediate: boolean = false,
  ) {
    const now = nowLocalIsoString();
    const endDate = subscription.endDate ? new Date(subscription.endDate as any) : null;
    const stillEntitled =
      !immediate &&
      subscription.status === 'ACTIVE' &&
      endDate !== null &&
      endDate.getTime() > Date.now();

    const updateFields: any = stillEntitled
      ? { canceledAt: now, updatedAt: now }
      : { status: 'CANCELED', canceledAt: now, updatedAt: now };

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update(updateFields)
      .eq('id', subscription.id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  /**
   * Anula as dívidas de assinatura EM ABERTO do cliente ao cancelar a assinatura,
   * e recalcula clients.hasDebts. Sem isso, o cliente cancelado ficava "Cancelada +
   * Inadimplente" fantasma (a dívida sobrevivia ao cancelamento).
   *
   * Recorte: 'Cobrança não paga%' (régua exclusiva do fluxo de inadimplência de
   * assinatura). Como cada cliente tem no máximo UMA assinatura, isto cobre os dois
   * tipos de dívida — a do cron (tag [sub:]) E a do webhook OVERDUE (tag [asaas:]) —
   * sem risco de pegar dívida de outra assinatura (não existe).
   *
   * A dívida é ANULADA por cancelamento, NÃO paga: amountPaid=0, paidAt=null,
   * sufixo [canceled] na descrição. Não toca em `payments` (dívida não é pagamento)
   * → não gera receita nem mexe no caixa.
   */
  private async settleSubscriptionDebtsOnCancel(
    clientId: string | null | undefined,
  ): Promise<void> {
    if (!clientId) return;

    const { data: openDebts } = await this.supabase
      .from('debts')
      .select('id, description')
      .eq('clientId', clientId)
      .eq('isSettled', false)
      .ilike('description', 'Cobrança não paga%');

    if (openDebts && openDebts.length > 0) {
      const now = nowLocalIsoString();
      for (const debt of openDebts) {
        await this.supabase
          .from('debts')
          .update({
            amountPaid: 0,
            remainingBalance: 0,
            isSettled: true,
            paidAt: null, // anulada por cancelamento, NÃO paga — sem receita
            description: `${(debt as any).description ?? ''} [canceled]`,
            updatedAt: now,
          })
          .eq('id', (debt as any).id);
      }
      this.logger.log(
        `Cancelamento: ${openDebts.length} dívida(s) de assinatura anulada(s) para o cliente ${clientId}.`,
      );
    }

    // Recalcula hasDebts pelas dívidas em aberto RESTANTES (ex: dívida avulsa de
    // comanda continua valendo). Usa .length (não count) p/ ser idêntico no mock.
    const { data: remaining } = await this.supabase
      .from('debts')
      .select('id')
      .eq('clientId', clientId)
      .eq('isSettled', false);

    await this.supabase
      .from('clients')
      .update({ hasDebts: (remaining?.length ?? 0) > 0 })
      .eq('id', clientId);
  }

  async useCut(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    // Segurança: verificar se endDate não venceu
    if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
      const now = nowLocalIsoString();
      await this.supabase
        .from('client_subscriptions')
        .update({ status: 'SUSPENDED', updatedAt: now })
        .eq('id', subscription.id);
      throw new BadRequestException('Assinatura vencida. Realize o pagamento para renovar os créditos.');
    }

    // Gate de pagamento do ciclo (mesma fonte da verdade do preço,
    // getActiveClientSubscription → isCurrentCyclePaid): sem pagamento confirmado do
    // ciclo vigente, o crédito de corte NÃO pode ser consumido. Sem este gate, um
    // assinante ACTIVE-não-pago debitava 1 corte do saldo enquanto o serviço era
    // cobrado cheio (getActiveClientSubscription retorna null) — pagava cheio E
    // perdia o corte. Bloqueia o débito indevido na raiz.
    if (!(await isCurrentCyclePaid(this.supabase, subscription))) {
      throw new BadRequestException(
        'Assinatura sem pagamento do ciclo vigente. Realize o pagamento para usar o crédito do plano.',
      );
    }

    const cutsPerMonth = subscription.plan?.cutsPerMonth ?? 0;
    const cutsUsed = subscription.cutsUsedThisMonth ?? 0;

    // Plano ilimitado (99) sempre permite
    if (cutsPerMonth !== 99 && cutsUsed >= cutsPerMonth) {
      throw new BadRequestException('Não há cortes disponíveis nesta assinatura');
    }

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ cutsUsedThisMonth: cutsUsed + 1 })
      .eq('id', subscription.id)
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) throw error;
    return updated;
  }

  async resetCuts(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    const now = nowLocalIsoString();
    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ cutsUsedThisMonth: 0, lastResetDate: now })
      .eq('id', subscription.id)
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) throw error;
    return updated;
  }

  /**
   * Busca dados do PIX pendente de uma assinatura específica (admin).
   * Variante de getMePendingPix que aceita subscriptionId em vez de clientId.
   */
  async getPendingPixForSubscription(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);
    if (subscription.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Assinatura não está aguardando pagamento');
    }

    const clientId = subscription.clientId;

    // Buscar último pagamento PIX pendente vinculado à assinatura ou ao cliente
    const { data: paymentsBySub } = await this.supabase
      .from('payments')
      .select('*')
      .eq('subscriptionId', subscription.id)
      .eq('method', 'PIX')
      .in('asaasStatus', ['PENDING', 'AWAITING_RISK_ANALYSIS'])
      .order('createdAt', { ascending: false })
      .limit(1);

    let payment = paymentsBySub?.[0];

    if (!payment) {
      const { data: paymentsByClient } = await this.supabase
        .from('payments')
        .select('*')
        .eq('clientId', clientId)
        .eq('method', 'PIX')
        .in('asaasStatus', ['PENDING', 'AWAITING_RISK_ANALYSIS'])
        .order('createdAt', { ascending: false })
        .limit(1);
      payment = paymentsByClient?.[0];
    }

    if (payment?.asaasPaymentId) {
      try {
        return await this.asaasService.getPixQrCode(payment.asaasPaymentId);
      } catch (e) {
        this.logger.warn(`Falha ao carregar QR Code PIX do banco local: ${e}`);
      }
    }

    // Fallback: buscar diretamente da assinatura no Asaas
    if (subscription.asaasSubscriptionId) {
      try {
        const charges = await this.asaasService.getSubscriptionPayments(subscription.asaasSubscriptionId);
        const pending = charges.find((c: any) =>
          (c.status === 'PENDING' || c.status === 'AWAITING_RISK_ANALYSIS') &&
          c.billingType === 'PIX',
        );
        if (pending) {
          return await this.asaasService.getPixQrCode(pending.id);
        }
      } catch (e) {
        this.logger.warn(`Falha no fallback de QR Code PIX via assinatura: ${e}`);
      }
    }

    // Fallback 2: cobranças avulsas do cliente no Asaas
    try {
      const { data: clientData } = await this.supabase
        .from('clients')
        .select('asaasCustomerId')
        .eq('id', clientId)
        .single();
      if (clientData?.asaasCustomerId) {
        const chargesRes = await this.asaasService.getPayments({
          customer: clientData.asaasCustomerId,
          status: 'PENDING',
        });
        const pending = (chargesRes?.data || []).find((c: any) => c.billingType === 'PIX');
        if (pending) {
          return await this.asaasService.getPixQrCode(pending.id);
        }
      }
    } catch (e) {
      this.logger.warn(`Falha no fallback 2 de QR Code PIX: ${e}`);
    }

    return null;
  }

  /**
   * Confirma manualmente o pagamento de uma assinatura PENDING_PAYMENT.
   * Marca como ACTIVE, zera cortes e renova endDate se já vencido.
   * Útil para casos de pagamento offline (dinheiro, transferência).
   */
  async confirmPaymentManually(subscriptionId: string, method?: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Apenas assinaturas aguardando pagamento podem ser confirmadas manualmente');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowLocal = nowLocalIsoString();

    // 1ª ativação (sempre vem de PENDING_PAYMENT): o ciclo começa AGORA, então o
    // vencimento é agora + 1 mês. NÃO reaproveitar o endDate da criação — ele já
    // era "agora + 1 mês" e mantê-lo/estendê-lo inflava o prazo (bug do +2 meses).
    const newEndDate = new Date(now);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({
        status: 'ACTIVE',
        cutsUsedThisMonth: 0,
        lastResetDate: nowIso,
        endDate: newEndDate.toISOString(),
        updatedAt: nowIso,
      })
      .eq('id', subscription.id)
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) throw error;

    // Registrar COMO foi paga a mensalidade, para o caixa contabilizar. Antes,
    // a confirmação manual só virava o status e nada entrava no caixa — o
    // relatório ficava furado (assinatura ACTIVE sem pagamento registrado).
    // Default CASH (dinheiro), que é o caso típico de confirmação no balcão.
    await this.recordBalcaoSubscriptionPayment(
      {
        id: subscription.id,
        clientId: subscription.clientId,
        amount: subscription.plan?.price ?? 0,
        planName: subscription.plan?.name ?? '',
      },
      method || 'CASH',
      nowLocal,
      'Confirmação manual de pagamento',
    );

    this.logger.log(`Assinatura ${subscription.id} confirmada manualmente (admin, ${method || 'CASH'}) — status ACTIVE até ${newEndDate.toISOString()}`);
    return updated;
  }

  /**
   * Confirma o pagamento do CICLO VIGENTE de uma assinatura JÁ ATIVA cujo mês não
   * foi pago (currentCyclePaid=false — ex: assinante ativo que pagou por fora /
   * balcão e ninguém registrou). Diferente de confirmPaymentManually:
   *  - exige status ACTIVE (não PENDING_PAYMENT);
   *  - APENAS registra o pagamento do mês (vai pro caixa, marca o ciclo pago);
   *  - NÃO mexe no endDate (não renova/estende o prazo) nem zera os cortes já usados.
   * Assim o assinante fica "em dia" mantendo o ciclo e o saldo de cortes atuais.
   */
  async confirmCyclePaymentManually(subscriptionId: string, method?: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Confirmação de ciclo só vale para assinatura ativa. Para outras, use o fluxo de reativação/confirmação.',
      );
    }

    // GUARDA ANTI-DUPLICATA: se o ciclo vigente JÁ tem pagamento confirmado (ex.: o
    // cartão recorrente do Asaas já caiu), NÃO registra outro — senão entra em dobro
    // no caixa (bug reportado: admin clicava "Confirmar pagamento" em quem já pagou
    // e o valor duplicava). Mesma régua de isCurrentCyclePaid.
    if (await isCurrentCyclePaid(this.supabase, subscription)) {
      throw new BadRequestException(
        'Este ciclo já tem pagamento registrado — não é necessário confirmar de novo (evita lançar em dobro no caixa).',
      );
    }

    const nowLocal = nowLocalIsoString();
    await this.recordBalcaoSubscriptionPayment(
      {
        id: subscription.id,
        clientId: subscription.clientId,
        amount: subscription.plan?.price ?? 0,
        planName: subscription.plan?.name ?? '',
      },
      method || 'CASH',
      nowLocal,
      'Confirmação de pagamento do ciclo',
    );

    this.logger.log(
      `Pagamento do ciclo da assinatura ${subscription.id} confirmado manualmente (admin, ${method || 'CASH'}) — sem alterar vencimento/cortes`,
    );
    return this.findSubscription(subscriptionId);
  }

  /**
   * Lança no CAIXA DO DIA o pagamento de uma mensalidade recebida no balcão
   * (dinheiro/PIX/cartão na maquininha) — sem passar pelo Asaas. Usado tanto na
   * confirmação manual de uma assinatura PENDING_PAYMENT quanto na assinatura/
   * renovação direta no balcão (subscribeClient com paymentMethod). É o que faz
   * "renovei hoje → caiu no caixa de hoje" voltar a funcionar.
   *
   * - businessDate = dia do pagamento (assinatura não tem agendamento).
   * - Vincula ao caixa do dia (recalcula se já fechado), mesmo padrão do webhook.
   * - Nunca lança exceção: se o insert falhar, só loga — a ativação da assinatura
   *   (feita pelo caller) é preservada e o pagamento pode ser relançado depois.
   */
  private async recordBalcaoSubscriptionPayment(
    sub: { id: string; clientId: string; amount: number; planName: string },
    method: string,
    nowLocal: string,
    notePrefix: string,
  ): Promise<void> {
    const amount = sub.amount ?? 0;
    if (amount <= 0) return;

    // Assinatura não tem agendamento → data contábil = dia do pagamento.
    const businessDate = resolveBusinessDate(null, nowLocal);
    const paymentId = randomUUID();
    const { error: payError } = await this.supabase.from('payments').insert({
      id: paymentId,
      clientId: sub.clientId,
      subscriptionId: sub.id,
      amount,
      method,
      registeredBy: await this.resolveSystemRegisteredBy(),
      notes: `${notePrefix} (assinatura ${sub.planName})`.trim(),
      paidAt: nowLocal,
      businessDate,
      createdAt: nowLocal,
      updatedAt: nowLocal,
    });
    if (payError) {
      // Não desfaz a ativação — apenas loga. A assinatura ativou; o pagamento
      // pode ser relançado manualmente se necessário.
      this.logger.error(`Falha ao registrar pagamento de balcão (assinatura ${sub.id}): ${JSON.stringify(payError)}`);
      return;
    }
    await this.cashRegisterService
      .linkPaymentToBusinessDateRegister(paymentId, businessDate)
      .catch((e) => this.logger.warn(`Falha ao vincular pagamento ${paymentId} ao caixa: ${e}`));

    // Houve pagamento real → o ciclo deixa de ser cortesia. Assim, um lapso futuro
    // volta a gerar inadimplência normalmente (não fica "grátis para sempre").
    await this.supabase
      .from('client_subscriptions')
      .update({ isComp: false })
      .eq('id', sub.id)
      .eq('isComp', true);
  }

  /**
   * Reconcilia o estado local com o Asaas (fonte da verdade).
   *
   * Caso de uso: cliente pagou o PIX, Asaas marcou como RECEIVED/CONFIRMED, mas o webhook
   * nunca chegou ou falhou — assinatura ficou presa em PENDING_PAYMENT. Este método busca
   * todas as cobranças do cliente/assinatura no Asaas, encontra qualquer uma quitada e
   * ativa a assinatura retroativamente (idempotente).
   *
   * Retorna a assinatura possivelmente atualizada.
   */
  async syncWithAsaas(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);
    if (!this.asaasService.configured) return subscription;
    if (subscription.status === 'CANCELED') return subscription;

    // ACTIVE: só há o que reconciliar se o CICLO VIGENTE não consta pago. Caso real:
    // cliente pagou (Asaas RECEIVED) mas o webhook se perdeu e o payment local ficou
    // com paidAt de um ciclo anterior (ou ausente) → isCurrentCyclePaid dá falso e a
    // assinatura aparece "Ativo + Ciclo não pago". Antes o sync saía cedo p/ toda ACTIVE,
    // então esses casos nunca eram curados (nem pelo botão nem pelo cron). Se o ciclo já
    // consta pago, nada a fazer.
    const wasActive = subscription.status === 'ACTIVE';
    if (wasActive && (await isCurrentCyclePaid(this.supabase, subscription))) {
      return subscription;
    }

    const charges = await this.collectAsaasChargesForSubscription(subscription);
    if (charges.length === 0) return subscription;

    // Só considera PAGA uma cobrança que: (a) está RECEIVED/CONFIRMED/RECEIVED_IN_CASH
    // E (b) foi paga A PARTIR do início do ciclo atual da assinatura. Cobranças pagas
    // ANTES do ciclo atual são de um período já encerrado (re-assinatura reaproveita a
    // mesma linha client_subscriptions) — reconhecê-las aqui reativava a assinatura e
    // jogava receita de meses atrás no caixa do dia da reconciliação (receita-fantasma).
    const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    // Piso do ciclo: MESMA régua de isCurrentCyclePaid/findAllSubscriptions
    // (subscriptionCycleFloorMs) — max(startDate,createdAt) - 1 dia, normalizado p/
    // meia-noite UTC. Tolerância de 1 dia cobre pagamento feito pouco antes da virada.
    const cycleFloorMs = this.subscriptionCycleFloorMs(subscription);
    const chargePaidMs = (c: any): number | null => {
      const raw = c?.paymentDate || c?.confirmedDate || c?.clientPaymentDate || null;
      if (!raw) return null;
      const t = new Date(`${String(raw).substring(0, 10)}T12:00:00`).getTime();
      return Number.isNaN(t) ? null : t;
    };

    const paid = charges.find((c: any) => {
      if (!PAID_STATUSES.includes(c.status)) return false;
      const pidMs = chargePaidMs(c);
      if (pidMs === null) return false; // pago sem data → não confiável, ignora
      return pidMs >= cycleFloorMs; // só pagamentos do ciclo atual em diante
    });

    if (!paid) {
      // Nenhuma cobrança paga RELEVANTE ao ciclo atual. Reflete o status da cobrança
      // mais recente no payments local sem marcar como pago (best-effort).
      await this.upsertLocalPaymentFromCharge(subscription, charges[0]).catch(() => {});
      return subscription;
    }

    this.logger.warn(
      `[sync-asaas] Assinatura ${subscription.id} estava ${subscription.status} mas Asaas mostra cobrança ${paid.id} como ${paid.status}. Reconciliando.`,
    );

    // Grava/corrige o payment local com a DATA REAL do pagamento (paidAt). É isto que faz
    // isCurrentCyclePaid voltar a true e some o "Ciclo não pago".
    await this.upsertLocalPaymentFromCharge(subscription, paid, true);

    // Quita a inadimplência do ciclo em qualquer caso (some "Inadimplente").
    await this.settleSubscriptionDelinquencyDebts(subscription, paid.id).catch((e) =>
      this.logger.error(`[sync-asaas] falha ao quitar dívida da assinatura ${subscription.id}: ${e}`),
    );

    // Já estava ACTIVE: o pagamento do ciclo só não constava (webhook perdido). Registrar
    // o payment com a data real já cura o "Ciclo não pago". NÃO renova a janela (endDate)
    // nem zera os cortes — não é uma renovação, é a correção do ciclo CORRENTE.
    if (wasActive) {
      this.logger.log(
        `[sync-asaas] Assinatura ${subscription.id} (ACTIVE) — ciclo reconciliado com cobrança ${paid.id}.`,
      );
      return await this.findSubscription(subscription.id);
    }

    const now = new Date();
    // Ativação retroativa a partir de status não-ACTIVE (PENDING/SUSPENDED): o ciclo
    // recomeça no pagamento → agora + 1 mês. (Antes estendia do endDate atual, que já
    // vinha "agora + 1 mês" da criação, inflando para 2 meses.)
    const newEndDate = new Date(now);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({
        status: 'ACTIVE',
        cutsUsedThisMonth: 0,
        lastResetDate: now.toISOString(),
        endDate: newEndDate.toISOString(),
        updatedAt: now.toISOString(),
      })
      .eq('id', subscription.id)
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) {
      this.logger.error(`[sync-asaas] Falha ao ativar assinatura ${subscription.id}: ${error.message}`);
      throw error;
    }

    this.logger.log(`[sync-asaas] Assinatura ${subscription.id} ativada via reconciliação (cobrança ${paid.id}).`);
    // (a inadimplência do ciclo já foi quitada acima, antes do branch wasActive)

    return updated;
  }

  /**
   * Quita a(s) dívida(s) de inadimplência de uma assinatura e recalcula clients.hasDebts.
   * Correlaciona pela tag embutida na descrição: [sub:<id>:cycle:...] (cron de vencimento)
   * ou [asaas:<paymentId>] (webhook OVERDUE); fallback pela régua 'Cobrança não paga%'
   * (dívidas legadas sem tag). Idempotente: se não há dívida em aberto, é no-op.
   */
  private async settleSubscriptionDelinquencyDebts(subscription: any, paidChargeId?: string) {
    const clientId = subscription?.clientId;
    if (!clientId) return;

    const openDebts = async (descLike: string) => {
      const { data } = await this.supabase
        .from('debts')
        .select('id, amount')
        .eq('clientId', clientId)
        .eq('isSettled', false)
        .ilike('description', descLike);
      return data || [];
    };

    // 1º tenta escopar à PRÓPRIA assinatura (não quita dívida de outra assinatura do mesmo
    // cliente). 2º à cobrança paga. 3º régua ampla (legado sem tag).
    let debts = await openDebts(`%[sub:${subscription.id}%`);
    if (debts.length === 0 && paidChargeId) {
      debts = await openDebts(`%[asaas:${paidChargeId}]%`);
    }
    if (debts.length === 0) {
      debts = await openDebts('Cobrança não paga%');
    }
    if (debts.length === 0) return;

    const now = nowLocalIsoString();
    for (const debt of debts) {
      await this.supabase
        .from('debts')
        .update({
          amountPaid: debt.amount,
          remainingBalance: 0,
          isSettled: true,
          paidAt: now,
          updatedAt: now,
        })
        .eq('id', debt.id);
    }

    // Recalcula hasDebts pelas dívidas em aberto RESTANTES (preserva dívida avulsa).
    const { data: remaining } = await this.supabase
      .from('debts')
      .select('id')
      .eq('clientId', clientId)
      .eq('isSettled', false);

    await this.supabase
      .from('clients')
      .update({ hasDebts: (remaining?.length ?? 0) > 0 })
      .eq('id', clientId);

    this.logger.log(
      `[sync-asaas] Dívida(s) de inadimplência da assinatura ${subscription.id} quitada(s) na reconciliação (${debts.length} registro(s)).`,
    );
  }

  /**
   * Coleta todas as cobranças relevantes de uma assinatura no Asaas.
   * Tenta 3 caminhos: (1) por asaasSubscriptionId, (2) por externalReference (sub.id),
   * (3) por asaasPaymentId já gravado no payments local. Deduplica por id.
   */
  private async collectAsaasChargesForSubscription(subscription: any): Promise<any[]> {
    const found = new Map<string, any>();

    if (subscription.asaasSubscriptionId) {
      try {
        const list = await this.asaasService.getSubscriptionPayments(subscription.asaasSubscriptionId);
        for (const c of list || []) found.set(c.id, c);
      } catch (e) {
        this.logger.warn(`[sync-asaas] getSubscriptionPayments falhou: ${e}`);
      }
    }

    try {
      const byRef = await this.asaasService.getPayments({ externalReference: subscription.id });
      for (const c of byRef?.data || []) found.set(c.id, c);
    } catch (e) {
      this.logger.warn(`[sync-asaas] getPayments(externalReference=${subscription.id}) falhou: ${e}`);
    }

    try {
      const { data: localPayments } = await this.supabase
        .from('payments')
        .select('asaasPaymentId')
        .eq('subscriptionId', subscription.id)
        .not('asaasPaymentId', 'is', null);

      for (const p of localPayments || []) {
        if (!p.asaasPaymentId || found.has(p.asaasPaymentId)) continue;
        try {
          const charge = await this.asaasService.getCharge(p.asaasPaymentId);
          if (charge) found.set(charge.id, charge);
        } catch (e) {
          this.logger.warn(`[sync-asaas] getCharge(${p.asaasPaymentId}) falhou: ${e}`);
        }
      }
    } catch (e) {
      this.logger.warn(`[sync-asaas] busca de payments locais falhou: ${e}`);
    }

    return Array.from(found.values());
  }

  /**
   * Extrai a DATA REAL do pagamento de uma cobrança Asaas, no formato canônico
   * local "YYYY-MM-DDT00:00:00". O Asaas informa paymentDate/confirmedDate/
   * clientPaymentDate (YYYY-MM-DD) só quando a cobrança foi efetivamente paga.
   * Retorna null quando nenhuma dessas datas existe (cobrança não paga de fato).
   *
   * Por que isto importa: a reconciliação pode rodar DIAS depois do pagamento
   * (ou pegar uma cobrança de um ciclo antigo). Usar `now` como data contábil
   * jogava a venda no caixa do dia da reconciliação — inflando o faturamento de
   * "hoje" com pagamentos que aconteceram (ou não) em outro dia. A data contábil
   * tem que ser o dia REAL do pagamento.
   */
  private resolveChargePaidDate(charge: any): string | null {
    const raw =
      charge?.paymentDate ||
      charge?.confirmedDate ||
      charge?.clientPaymentDate ||
      null;
    if (!raw) return null;
    // raw vem como "YYYY-MM-DD" (ou ISO). resolveBusinessDate normaliza p/ o
    // formato canônico de 19 chars usado nas janelas do caixa.
    return resolveBusinessDate(null, `${String(raw).substring(0, 10)}T00:00:00`);
  }

  /**
   * Piso do ciclo vigente em ms (mesma régua de isCurrentCyclePaid): o mais recente
   * entre startDate e createdAt, menos 1 dia, normalizado p/ início do dia em UTC.
   */
  private subscriptionCycleFloorMs(subscription: {
    startDate?: string | null;
    createdAt?: string | null;
  }): number {
    // Fonte única: pricing.helper.subscriptionCycleFloorMs (mesma régua de
    // isCurrentCyclePaid). Não reimplementar `start - 1dia` cru aqui.
    return subscriptionCycleFloorMs(subscription);
  }

  /**
   * Insere ou atualiza o registro local de payment a partir de uma cobrança Asaas.
   * Se markPaid=true, marca como pago usando a DATA REAL do pagamento informada
   * pelo Asaas (não a data da reconciliação). Se o Asaas não informar a data
   * (cobrança não paga de fato), NÃO marca como pago — evita receita-fantasma.
   */
  private async upsertLocalPaymentFromCharge(subscription: any, charge: any, markPaid = false) {
    const now = nowLocalIsoString();
    const { data: existing } = await this.supabase
      .from('payments')
      .select('id, paidAt, asaasStatus')
      .eq('asaasPaymentId', charge.id)
      .maybeSingle();

    const billingType = charge.billingType || 'PIX';
    const localMethod = asaasBillingToLocalPaymentMethod(
      billingType === 'CREDIT_CARD' ? AsaasBillingType.CREDIT_CARD : AsaasBillingType.PIX,
    );
    const amount = this.asaasService.reaisToCentavos(charge.value || 0);

    // Data contábil = dia REAL do pagamento (informado pelo Asaas), não `now`.
    // Se markPaid mas o Asaas não traz data de pagamento, a cobrança não está
    // realmente paga: não contabiliza (paidAt/businessDate ficam null).
    const paidDate = markPaid ? this.resolveChargePaidDate(charge) : null;
    const effectivelyPaid = markPaid && !!paidDate;
    const businessDate = paidDate; // null quando não pago de fato
    const paidAtValue = paidDate; // mesma data real (canônica) para paidAt

    // 4 últimos dígitos + bandeira do cartão (só vem em cobrança paga com cartão).
    // O Asaas nunca devolve o número completo — só os 4 últimos. Seguro de guardar.
    const cardLast4 = charge.creditCard?.creditCardNumber || null;
    const cardBrand = charge.creditCard?.creditCardBrand || null;

    // Cartão tokenizado (só vem em cobrança ONLINE paga no cartão — maquininha não
    // tokeniza). Guarda no cliente p/ a ação "Cobrar no cartão" debitar direto depois.
    await this.captureClientCardToken(subscription.clientId, charge);

    if (existing) {
      const update: any = { asaasStatus: charge.status, updatedAt: now };
      if (cardLast4) update.cardLast4 = cardLast4;
      if (cardBrand) update.cardBrand = cardBrand;
      if (effectivelyPaid && !existing.paidAt) {
        // 1º registro do pagamento: data real + dia contábil + vincula caixa (abaixo).
        update.paidAt = paidAtValue;
        update.businessDate = businessDate;
      } else if (effectivelyPaid && existing.paidAt) {
        // Já tinha paidAt, mas pode estar FORA do ciclo vigente (data de um ciclo
        // anterior / confirmedDate antecipado de cartão) → isCurrentCyclePaid usa paidAt
        // e dá falso: "Ciclo não pago" mesmo a cobrança estando paga no Asaas. Corrige
        // SÓ o paidAt p/ a data real da cobrança. NÃO mexe no businessDate: a receita já
        // está alocada no caixa (cartão com antecipação entra o dinheiro no dia da
        // confirmação) e mover perturbaria caixa já fechado sem necessidade.
        const floorMs = this.subscriptionCycleFloorMs(subscription);
        const existingMs = new Date(existing.paidAt).getTime();
        const newMs = paidDate ? new Date(paidDate).getTime() : NaN;
        const staleOutOfCycle =
          floorMs > 0 &&
          !Number.isNaN(existingMs) &&
          existingMs < floorMs &&
          !Number.isNaN(newMs) &&
          newMs >= floorMs;
        if (staleOutOfCycle) update.paidAt = paidAtValue;
      }
      await this.supabase.from('payments').update(update).eq('id', existing.id);
      // Vincula ao caixa do dia contábil (recalcula se já fechado) ao confirmar.
      if (effectivelyPaid && !existing.paidAt && businessDate) {
        await this.cashRegisterService.linkPaymentToBusinessDateRegister(
          existing.id,
          businessDate,
        );
      }
      return existing.id;
    }

    const id = randomUUID();
    await this.supabase.from('payments').insert({
      id,
      clientId: subscription.clientId,
      subscriptionId: subscription.id,
      amount,
      method: localMethod,
      registeredBy: await this.resolveSystemRegisteredBy(),
      notes: `Reconciliação Asaas (cobrança ${charge.id})`,
      asaasPaymentId: charge.id,
      asaasStatus: charge.status,
      paidAt: effectivelyPaid ? paidAtValue : null,
      businessDate,
      cardLast4,
      cardBrand,
      invoiceUrl: charge.invoiceUrl || null,
      bankSlipUrl: charge.bankSlipUrl || null,
      createdAt: now,
      updatedAt: now,
    });
    if (effectivelyPaid && businessDate) {
      await this.cashRegisterService.linkPaymentToBusinessDateRegister(id, businessDate);
    }
    return id;
  }

  /**
   * Gera uma NOVA cobrança PIX para uma assinatura PENDING_PAYMENT (admin).
   * Útil quando o PIX original expirou ou nunca foi vinculado ao Asaas.
   */
  async regeneratePixForSubscription(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Apenas assinaturas aguardando pagamento podem ter o PIX regenerado');
    }

    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não configurada');
    }

    const clientId = subscription.clientId;
    const planPrice = subscription.plan?.price ?? 0;
    const planName = subscription.plan?.name ?? 'Assinatura';

    const asaasCustomerId = await this.ensureAsaasCustomer(clientId);

    const today = nowLocalIsoString().split('T')[0];
    const charge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: AsaasBillingType.PIX,
      value: this.asaasService.centavosToReais(planPrice),
      dueDate: today,
      description: `Plano ${planName} (PIX regenerado)`,
      externalReference: subscription.id,
    });

    const now = nowLocalIsoString();
    await this.supabase.from('payments').insert({
      id: randomUUID(),
      clientId,
      subscriptionId: subscription.id,
      amount: planPrice,
      method: asaasBillingToLocalPaymentMethod(AsaasBillingType.PIX),
      registeredBy: await this.resolveSystemRegisteredBy(),
      notes: `PIX regenerado plano ${planName} #${charge.id}`,
      asaasPaymentId: charge.id,
      asaasStatus: charge.status,
      paidAt: null,
      invoiceUrl: charge.invoiceUrl || null,
      bankSlipUrl: charge.bankSlipUrl || null,
      createdAt: now,
      updatedAt: now,
    });

    let pixData: any = null;
    try {
      pixData = await this.asaasService.getPixQrCode(charge.id);
    } catch (e) {
      this.logger.warn(`QR Code PIX regenerado tentativa 1 falhou, retry em 2s: ${e}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        pixData = await this.asaasService.getPixQrCode(charge.id);
      } catch (e2) {
        this.logger.warn(`QR Code PIX regenerado retry falhou: ${e2}`);
      }
    }

    if (!pixData) {
      throw new BadRequestException('Cobrança gerada, mas não foi possível obter o QR Code. Tente novamente em instantes.');
    }

    this.logger.log(`PIX regenerado para assinatura ${subscription.id}: charge ${charge.id}`);
    return pixData;
  }

  /**
   * Hard-delete de uma assinatura (admin).
   * Remove o registro do histórico. Use com cautela — perde dados de auditoria.
   */
  async removeSubscription(id: string) {
    const subscription = await this.findSubscription(id);

    // Se ainda está vinculada a uma assinatura ativa no Asaas, tentar cancelar lá primeiro
    if (this.asaasService.configured && subscription.asaasSubscriptionId && subscription.status !== 'CANCELED') {
      try {
        await this.asaasService.cancelSubscription(subscription.asaasSubscriptionId);
        this.logger.log(`Assinatura Asaas cancelada antes da remoção: ${subscription.asaasSubscriptionId}`);
      } catch (syncError) {
        this.logger.warn(`Falha ao cancelar assinatura no Asaas durante remoção: ${syncError}`);
      }
    }

    const { error } = await this.supabase
      .from('client_subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    this.logger.log(`Assinatura ${id} removida do histórico (admin)`);
    return { id, deleted: true };
  }

  /**
   * Força uma cobrança manual no Asaas para uma assinatura específica.
   * Cria um registro de pagamento pendente vinculado à assinatura.
   */
  // CLIENT-FACING METHODS (JWT auth)

  async getMySubscription(clientId: string) {
    return this.findClientSubscription(clientId);
  }

  async getMePendingPix(clientId: string) {
    const subscription = await this.findClientSubscription(clientId);
    if (!subscription || subscription.status !== 'PENDING_PAYMENT') {
      return null;
    }

    // Buscar último pagamento PIX pendente para esta assinatura ou cliente
    const { data: payments } = await this.supabase
      .from('payments')
      .select('*')
      .eq('clientId', clientId)
      .eq('method', 'PIX')
      .in('asaasStatus', ['PENDING', 'AWAITING_RISK_ANALYSIS'])
      .order('createdAt', { ascending: false })
      .limit(1);

    const payment = payments?.[0];
    if (payment?.asaasPaymentId) {
      try {
        return await this.asaasService.getPixQrCode(payment.asaasPaymentId);
      } catch (e) {
        this.logger.warn(`Falha ao carregar QR Code PIX do banco local: ${e}`);
      }
    }

    // Fallback: buscar diretamente da assinatura no Asaas
    if (subscription.asaasSubscriptionId) {
      try {
        const charges = await this.asaasService.getSubscriptionPayments(subscription.asaasSubscriptionId);
        const pending = charges.find((c: any) => 
          (c.status === 'PENDING' || c.status === 'AWAITING_RISK_ANALYSIS') && 
          c.billingType === 'PIX'
        );
        if (pending) {
          return await this.asaasService.getPixQrCode(pending.id);
        }
      } catch (e) {
        this.logger.warn(`Falha no fallback de QR Code PIX via assinatura: ${e}`);
      }
    }

    // Fallback 2: buscar cobranças avulsas do cliente no Asaas (se for reativação manual)
    try {
        const { data: clientData } = await this.supabase.from('clients').select('asaasCustomerId').eq('id', clientId).single();
        if (clientData?.asaasCustomerId) {
            const chargesRes = await this.asaasService.getPayments({
                customer: clientData.asaasCustomerId, 
                status: 'PENDING'
            });
            const pending = (chargesRes?.data || []).find((c: any) => c.billingType === 'PIX');
            if (pending) {
                return await this.asaasService.getPixQrCode(pending.id);
            }
        }
    } catch (e) {
        this.logger.warn(`Falha no fallback 2 de QR Code PIX: ${e}`);
    }

    return null;
  }

  /**
   * Cria uma ASSINATURA RECORRENTE no Asaas (cobra todo mês sozinho) e grava o
   * asaasSubscriptionId na assinatura local. Devolve a 1ª cobrança gerada pela
   * assinatura, para o caller registrar o payment local e o PIX/checkout.
   *
   * Substitui o createCharge avulso: antes cada renovação exigia uma nova cobrança;
   * agora o Asaas gera a fatura de cada ciclo (mensal) e o webhook a confirma. Cada
   * cobrança herda externalReference = id da assinatura local, então o webhook
   * (handlePaymentConfirmed) ativa/renova sozinho — cartão cobra automático, PIX gera
   * a fatura mensal p/ o cliente pagar.
   */
  private async createRecurringSubscriptionAndFirstCharge(params: {
    clientSubscriptionId: string;
    customer: string;
    billingType: AsaasBillingType;
    valueReais: number;
    description: string;
    creditCard?: AsaasCreditCard;
    creditCardHolderInfo?: AsaasCreditCardHolderInfo;
    remoteIp?: string;
  }): Promise<AsaasCharge> {
    // Evita assinaturas Asaas órfãs: se este registro local já apontava p/ uma
    // assinatura recorrente (re-assinatura / reativação reaproveitam a mesma linha),
    // cancela a antiga antes de criar a nova p/ não ficar cobrando em duplicidade.
    const { data: prev } = await this.supabase
      .from('client_subscriptions')
      .select('asaasSubscriptionId')
      .eq('id', params.clientSubscriptionId)
      .maybeSingle();
    const prevAsaasSubId = (prev as any)?.asaasSubscriptionId;
    if (prevAsaasSubId) {
      await this.asaasService
        .cancelSubscription(prevAsaasSubId)
        .then(() => this.logger.log(`Assinatura Asaas antiga ${prevAsaasSubId} cancelada antes de recriar.`))
        .catch((e) => this.logger.warn(`Falha ao cancelar assinatura Asaas antiga ${prevAsaasSubId}: ${e}`));
    }

    const today = nowLocalIsoString().split('T')[0];
    const asaasSub = await this.asaasService.createSubscription({
      customer: params.customer,
      billingType: params.billingType,
      value: params.valueReais,
      nextDueDate: today,
      cycle: AsaasSubscriptionCycle.MONTHLY,
      description: params.description,
      externalReference: params.clientSubscriptionId,
      creditCard: params.creditCard,
      creditCardHolderInfo: params.creditCardHolderInfo,
      remoteIp: params.remoteIp,
    });

    await this.supabase
      .from('client_subscriptions')
      .update({ asaasSubscriptionId: asaasSub.id, updatedAt: nowLocalIsoString() })
      .eq('id', params.clientSubscriptionId);

    // A 1ª cobrança do ciclo nasce junto com a assinatura, mas pode levar 1-2s
    // para o Asaas materializá-la. Tenta algumas vezes antes de desistir.
    let firstCharge: AsaasCharge | undefined;
    for (let attempt = 0; attempt < 3 && !firstCharge; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
      const charges = await this.asaasService
        .getSubscriptionPayments(asaasSub.id)
        .catch(() => [] as AsaasCharge[]);
      firstCharge = charges?.[0];
    }
    if (!firstCharge) {
      // Sem 1ª cobrança → o caller vai abortar (marca a assinatura local CANCELED).
      // Cancela a assinatura Asaas recém-criada p/ ela NÃO continuar cobrando o
      // cliente num registro abandonado (senão um webhook futuro reativaria a
      // assinatura cancelada via asaasSubscriptionId).
      await this.asaasService
        .cancelSubscription(asaasSub.id)
        .catch((e) => this.logger.warn(`Falha ao cancelar assinatura Asaas órfã ${asaasSub.id}: ${e}`));
      throw new Error(
        `Assinatura Asaas ${asaasSub.id} criada, mas nenhuma cobrança foi gerada (cancelada).`,
      );
    }
    return firstCharge;
  }

  async subscribeByClientId(clientId: string, planId: string, body: SubscribeMeDto) {
    const billingTypeRaw = body.billingType;
    const parsed = parseAsaasBillingType(billingTypeRaw);
    const effectiveBilling =
      parsed === AsaasBillingType.CREDIT_CARD
        ? AsaasBillingType.CREDIT_CARD
        : AsaasBillingType.PIX;

    const subscription = await this.subscribeClient({
      clientId,
      planId,
      billingType: effectiveBilling === AsaasBillingType.CREDIT_CARD ? 'CREDIT_CARD' : 'PIX',
    });

    let pixData: any = null;
    let invoiceUrl: string | null = null;
    const freshSub = await this.findClientSubscription(clientId);

    if (this.asaasService.configured && freshSub) {
      try {
        const asaasCustomerId = await this.ensureAsaasCustomer(clientId);

        // Assinatura RECORRENTE (cobra todo mês) em vez de cobrança avulsa.
        const charge = await this.createRecurringSubscriptionAndFirstCharge({
          clientSubscriptionId: freshSub.id,
          customer: asaasCustomerId,
          billingType: effectiveBilling,
          valueReais: this.asaasService.centavosToReais(freshSub.plan?.price ?? 0),
          description: `Plano ${freshSub.plan?.name ?? 'Assinatura'}`,
          creditCard: body.creditCard,
          creditCardHolderInfo: body.creditCardHolderInfo,
          remoteIp: body.remoteIp,
        });

        invoiceUrl = charge.invoiceUrl || null;
        const now = nowLocalIsoString();
        const localMethod = asaasBillingToLocalPaymentMethod(effectiveBilling);

        // Idempotência: cartão confirma na hora e o webhook pode já ter criado o
        // payment desta cobrança (via externalReference) durante o retry do helper.
        // Sem este guard, inseriríamos um 2º registro com o mesmo asaasPaymentId
        // (o índice não é único) → caixa contaria em dobro.
        const { data: existingPay } = await this.supabase
          .from('payments')
          .select('id')
          .eq('asaasPaymentId', charge.id)
          .maybeSingle();

        // Inserir registro de pagamento (antes do QR Code para garantir persistência)
        if (!existingPay) await this.supabase.from('payments').insert({
          id: randomUUID(),
          clientId,
          subscriptionId: freshSub.id,
          amount: freshSub.plan?.price ?? 0,
          method: localMethod,
          registeredBy: await this.resolveSystemRegisteredBy(),
          notes: `Cobrança inicial plano ${freshSub.plan?.name ?? 'Assinatura'} #${charge.id}`,
          asaasPaymentId: charge.id,
          asaasStatus: charge.status,
          paidAt: null,
          invoiceUrl,
          bankSlipUrl: charge.bankSlipUrl || null,
          createdAt: now,
          updatedAt: now,
        });

        // PIX QR Code — não-crítico, com retry (invoiceUrl serve de fallback)
        if (effectiveBilling === AsaasBillingType.PIX) {
          try {
            pixData = await this.asaasService.getPixQrCode(charge.id);
          } catch (pixError) {
            this.logger.warn(`QR Code PIX tentativa 1 falhou, retry em 2s: ${pixError}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              pixData = await this.asaasService.getPixQrCode(charge.id);
            } catch (retryError) {
              this.logger.warn(`QR Code PIX retry falhou: ${retryError}. invoiceUrl será usado como fallback.`);
            }
          }
        }

        this.logger.log(`Cobrança inicial criada: ${charge.id} - invoiceUrl: ${invoiceUrl}`);
      } catch (e) {
        // Falha crítica (customer/cobrança) — cancela assinatura para permitir retry limpo
        this.logger.error(`Falha ao criar cobrança Asaas: ${e}`);
        await this.supabase
          .from('client_subscriptions')
          .update({ status: 'CANCELED', updatedAt: nowLocalIsoString() })
          .eq('id', freshSub.id);
        const detail = e instanceof Error ? e.message : String(e);
        throw new BadRequestException(`Erro ao gerar cobrança no gateway de pagamento. Tente novamente. (${detail})`);
      }
    }

    return { subscription: freshSub ?? subscription, pixData, invoiceUrl };
  }

  async cancelMySubscription(clientId: string) {
    const subscription = await this.findClientSubscription(clientId);
    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada');
    }

    if (!['ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED'].includes(subscription.status)) {
      throw new BadRequestException('Assinatura não pode ser cancelada');
    }

    const updated = await this.applyCancellation({
      id: subscription.id,
      status: subscription.status,
      endDate: (subscription as any).endDate ?? null,
    });

    // Anula a dívida-fantasma desta assinatura (cliente cancela pré-pago: já pagou
    // o ciclo, só não vai renovar — a dívida do ciclo não-usado não deve persistir).
    await this.settleSubscriptionDebtsOnCancel(clientId);

    // Cancelar assinatura no Asaas (se vinculada) — para nao cobrar proximo ciclo
    if (this.asaasService.configured && subscription.asaasSubscriptionId) {
      try {
        await this.asaasService.cancelSubscription(subscription.asaasSubscriptionId);
        this.logger.log(`Assinatura Asaas cancelada: ${subscription.asaasSubscriptionId}`);
      } catch (syncError) {
        this.logger.warn(`Falha ao cancelar assinatura no Asaas: ${syncError}`);
      }
    }

    return updated;
  }

  // [REMOVED] Troca de plano (upgrade/downgrade) — feature removida por nao
  // ter UI no admin/cliente. Coluna pendingPlanId permanece no banco caso
  // queiramos reintroduzir no futuro.

  async reactivateMySubscription(clientId: string, body: ReactivateMeDto) {
    const billingTypeRaw = body.billingType;
    const parsed = parseAsaasBillingType(billingTypeRaw);
    const billingType =
      parsed === AsaasBillingType.CREDIT_CARD
        ? AsaasBillingType.CREDIT_CARD
        : AsaasBillingType.PIX;
    // Buscar assinatura suspensa
    const { data: results } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone, asaasCustomerId, email), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('clientId', clientId)
      .eq('status', 'SUSPENDED')
      .order('createdAt', { ascending: false })
      .limit(1);

    const subscription = results?.[0];
    if (!subscription) {
      throw new NotFoundException('Assinatura suspensa não encontrada');
    }

    // Novo ciclo: endDate = hoje + 1 mês
    const now = new Date();
    const newEndDate = new Date(now);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    // Marcar como aguardando pagamento e atualizar datas
    await this.supabase
      .from('client_subscriptions')
      .update({
        status: 'PENDING_PAYMENT',
        startDate: now.toISOString(),
        endDate: newEndDate.toISOString(),
        cutsUsedThisMonth: 0,
        canceledAt: null,
        updatedAt: now.toISOString(),
      })
      .eq('id', subscription.id);

    // Gerar cobrança via Asaas (se configurado)
    let pixData: any = null;
    let invoiceUrl: string | null = null;
    if (this.asaasService.configured) {
      try {
        const asaasCustomerId = await this.ensureAsaasCustomer(clientId);

        // Reativação cria a assinatura RECORRENTE no Asaas (cobra todo mês).
        const charge = await this.createRecurringSubscriptionAndFirstCharge({
          clientSubscriptionId: subscription.id,
          customer: asaasCustomerId,
          billingType,
          valueReais: this.asaasService.centavosToReais(subscription.plan?.price ?? 0),
          description: `Reativação: Plano ${subscription.plan?.name}`,
          creditCard: body.creditCard,
          creditCardHolderInfo: body.creditCardHolderInfo,
          remoteIp: body.remoteIp,
        });

        invoiceUrl = charge.invoiceUrl || null;
        const localMethod = asaasBillingToLocalPaymentMethod(billingType);

        // Idempotência: cartão confirma na hora e o webhook pode já ter criado o
        // payment desta cobrança durante o retry do helper (índice não é único).
        const { data: existingPay } = await this.supabase
          .from('payments')
          .select('id')
          .eq('asaasPaymentId', charge.id)
          .maybeSingle();

        // Inserir registro de pagamento (antes do QR Code para garantir persistência)
        if (!existingPay) await this.supabase.from('payments').insert({
          id: randomUUID(),
          clientId,
          subscriptionId: subscription.id,
          amount: subscription.plan?.price ?? 0,
          method: localMethod,
          registeredBy: await this.resolveSystemRegisteredBy(),
          notes: `Reativação assinatura Asaas #${charge.id}`,
          asaasPaymentId: charge.id,
          asaasStatus: charge.status,
          paidAt: null,
          invoiceUrl,
          bankSlipUrl: charge.bankSlipUrl || null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });

        // PIX QR Code — não-crítico, com retry
        if (billingType === AsaasBillingType.PIX) {
          try {
            pixData = await this.asaasService.getPixQrCode(charge.id);
          } catch (pixError) {
            this.logger.warn(`QR Code PIX tentativa 1 falhou, retry em 2s: ${pixError}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              pixData = await this.asaasService.getPixQrCode(charge.id);
            } catch (retryError) {
              this.logger.warn(`QR Code PIX retry falhou: ${retryError}. invoiceUrl será usado como fallback.`);
            }
          }
        }
      } catch (e) {
        // Falha crítica — reverte para SUSPENDED para permitir retry
        this.logger.error(`Falha ao gerar cobrança de reativação: ${e}`);
        await this.supabase
          .from('client_subscriptions')
          .update({ status: 'SUSPENDED', updatedAt: now.toISOString() })
          .eq('id', subscription.id);
        const detail = e instanceof Error ? e.message : String(e);
        throw new BadRequestException(`Erro ao gerar cobrança de reativação. Tente novamente. (${detail})`);
      }
    }

    // Re-fetch atualizado
    const { data: updated } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans!planId(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('id', subscription.id)
      .single();

    if (!updated && subscription) {
        // Fallback para o objeto original se o re-fetch falhar
        return { subscription, pixData, invoiceUrl };
    }

    return { subscription: updated, pixData, invoiceUrl };
  }

  /**
   * ADMIN: gera um LINK de pagamento Asaas (invoiceUrl) para o cliente renovar
   * uma assinatura encerrada/vencida/aguardando, sem login no app. O admin manda
   * o link pelo WhatsApp; o cliente abre e paga (PIX avulso OU cartão — que fica
   * recorrente). A assinatura NÃO é ativada aqui: vira PENDING_PAYMENT e só o
   * webhook do Asaas a ativa quando o pagamento for confirmado. Nada entra no
   * caixa ao gerar o link (paidAt:null) — mesma blindagem do fluxo /me/reactivate.
   *
   * billingType UNDEFINED → checkout aberto (cliente escolhe PIX ou cartão no
   * link). Como cria uma ASSINATURA recorrente Asaas, pagamento no cartão passa a
   * cobrar automático nos próximos meses; PIX é mensal manual.
   */
  async renewSubscriptionViaAsaas(subscriptionId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada.');
    }
    const subscription = await this.findSubscription(subscriptionId);

    // Só renova quem não está ativo. ACTIVE tem o fluxo próprio (não recobrar quem
    // já está em dia por aqui).
    const renewableStatuses = ['SUSPENDED', 'EXPIRED', 'CANCELED', 'PENDING_PAYMENT'];
    if (!renewableStatuses.includes(subscription.status)) {
      throw new BadRequestException(
        `Assinatura com status ${subscription.status} não pode ser renovada por link.`,
      );
    }

    const now = new Date();
    const newEndDate = new Date(now);
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    const prevStatus = subscription.status;

    // Aguardando pagamento + novo ciclo. Ativação só vem pelo webhook.
    await this.supabase
      .from('client_subscriptions')
      .update({
        status: 'PENDING_PAYMENT',
        startDate: now.toISOString(),
        endDate: newEndDate.toISOString(),
        cutsUsedThisMonth: 0,
        canceledAt: null,
        updatedAt: now.toISOString(),
      })
      .eq('id', subscription.id);

    try {
      const asaasCustomerId = await this.ensureAsaasCustomer(subscription.clientId);

      // billingType UNDEFINED = link aberto (PIX ou cartão). Assinatura recorrente
      // → cartão fica automático nos próximos meses.
      const charge = await this.createRecurringSubscriptionAndFirstCharge({
        clientSubscriptionId: subscription.id,
        customer: asaasCustomerId,
        billingType: AsaasBillingType.UNDEFINED,
        valueReais: this.asaasService.centavosToReais(subscription.plan?.price ?? 0),
        description: `Renovação: Plano ${subscription.plan?.name ?? ''}`.trim(),
      });

      const invoiceUrl = charge.invoiceUrl || null;

      // Idempotência: não duplica payment se o webhook já criou um durante o retry.
      const { data: existingPay } = await this.supabase
        .from('payments')
        .select('id')
        .eq('asaasPaymentId', charge.id)
        .maybeSingle();
      if (!existingPay) {
        await this.supabase.from('payments').insert({
          id: randomUUID(),
          clientId: subscription.clientId,
          subscriptionId: subscription.id,
          amount: subscription.plan?.price ?? 0,
          method: asaasBillingToLocalPaymentMethod(charge.billingType || AsaasBillingType.PIX),
          registeredBy: await this.resolveSystemRegisteredBy(),
          notes: `Renovação via link Asaas #${charge.id}`,
          asaasPaymentId: charge.id,
          asaasStatus: charge.status,
          paidAt: null, // NÃO pago — só o webhook marca pago e lança no caixa
          invoiceUrl,
          bankSlipUrl: charge.bankSlipUrl || null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }

      return {
        invoiceUrl,
        client: {
          name: subscription.client?.name ?? null,
          phone: subscription.client?.phone ?? null,
        },
        planName: subscription.plan?.name ?? null,
      };
    } catch (e) {
      // Falha ao gerar cobrança → reverte ao status anterior para permitir retry.
      await this.supabase
        .from('client_subscriptions')
        .update({ status: prevStatus, updatedAt: now.toISOString() })
        .eq('id', subscription.id);
      const detail = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Erro ao gerar link de renovação. Tente novamente. (${detail})`);
    }
  }

  /**
   * Gera um LINK de pagamento Asaas (invoiceUrl) para o CICLO ATUAL de uma
   * assinatura ACTIVE cujo ciclo vigente ainda não foi pago ("Ciclo não pago").
   *
   * Diferente de renewSubscriptionViaAsaas (que é para assinaturas encerradas):
   * NÃO avança o ciclo, NÃO zera cortes e NÃO mexe em startDate/endDate — o
   * cliente continua no mesmo ciclo, só está cobrando o que ele já deve. O link
   * é aberto (PIX ou cartão) e cria a assinatura recorrente no Asaas, então o
   * cartão passa a cobrar automático nos próximos meses. A ativação do ciclo
   * (currentCyclePaid) vem pelo webhook quando o cliente paga — nada entra no
   * caixa até lá.
   */
  async chargeCurrentCycleViaAsaas(subscriptionId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada.');
    }
    const subscription = await this.findSubscription(subscriptionId);

    // Só ACTIVE. Encerradas usam renew-asaas; PENDING_PAYMENT usa regenerate-pix.
    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Apenas assinaturas ativas têm ciclo a cobrar. Status atual: ${subscription.status}.`,
      );
    }

    const now = new Date();

    const asaasCustomerId = await this.ensureAsaasCustomer(subscription.clientId);

    // billingType UNDEFINED = link aberto (PIX ou cartão). Assinatura recorrente
    // → cartão fica automático nos próximos meses. Não tocamos em datas/cortes:
    // é o ciclo atual em aberto, não uma renovação.
    const charge = await this.createRecurringSubscriptionAndFirstCharge({
      clientSubscriptionId: subscription.id,
      customer: asaasCustomerId,
      billingType: AsaasBillingType.UNDEFINED,
      valueReais: this.asaasService.centavosToReais(subscription.plan?.price ?? 0),
      description: `Assinatura: Plano ${subscription.plan?.name ?? ''}`.trim(),
    });

    const invoiceUrl = charge.invoiceUrl || null;

    // Idempotência: não duplica payment se o webhook já criou um durante o retry.
    const { data: existingPay } = await this.supabase
      .from('payments')
      .select('id')
      .eq('asaasPaymentId', charge.id)
      .maybeSingle();
    if (!existingPay) {
      await this.supabase.from('payments').insert({
        id: randomUUID(),
        clientId: subscription.clientId,
        subscriptionId: subscription.id,
        amount: subscription.plan?.price ?? 0,
        method: asaasBillingToLocalPaymentMethod(charge.billingType || AsaasBillingType.PIX),
        registeredBy: await this.resolveSystemRegisteredBy(),
        notes: `Cobrança do ciclo via link Asaas #${charge.id}`,
        asaasPaymentId: charge.id,
        asaasStatus: charge.status,
        paidAt: null, // NÃO pago — só o webhook marca pago e lança no caixa
        invoiceUrl,
        bankSlipUrl: charge.bankSlipUrl || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }

    return {
      invoiceUrl,
      client: {
        name: subscription.client?.name ?? null,
        phone: subscription.client?.phone ?? null,
      },
      planName: subscription.plan?.name ?? null,
    };
  }

  /**
   * Guarda no cliente o cartão tokenizado de uma cobrança Asaas, quando presente.
   * O Asaas só devolve `creditCard.creditCardToken` em cobrança ONLINE paga no
   * cartão (link/app) — maquininha NÃO tokeniza. Idempotente: sempre sobrescreve
   * com o último token visto. Sem token → no-op (mantém o que havia).
   */
  private async captureClientCardToken(clientId: string | null | undefined, charge: any) {
    const token = charge?.creditCard?.creditCardToken || null;
    if (!clientId || !token) return;
    await this.supabase
      .from('clients')
      .update({
        asaasCreditCardToken: token,
        asaasCreditCardLast4: charge.creditCard?.creditCardNumber || null,
        asaasCreditCardBrand: charge.creditCard?.creditCardBrand || null,
        updatedAt: nowLocalIsoString(),
      })
      .eq('id', clientId);
  }

  /**
   * ADMIN: debita o ciclo vigente DIRETO no cartão salvo do cliente (sem reabrir
   * link). Só funciona se o cliente tem `asaasCreditCardToken` (pagou online no
   * cartão antes). Maquininha não tokeniza → cai no erro e o admin usa "Gerar
   * cobrança" (link). Não mexe em data/cortes aqui; a confirmação vem do
   * webhook/syncWithAsaas, que p/ assinatura ACTIVE quita o ciclo MANTENDO o
   * vencimento (não renova). Cartão recusado → BadRequest, nada é marcado pago.
   */
  async chargeStoredCardForCurrentCycle(subscriptionId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada.');
    }
    const subscription = await this.findSubscription(subscriptionId);
    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Apenas assinaturas ativas têm ciclo a cobrar. Status atual: ${subscription.status}.`,
      );
    }

    const { data: client } = await this.supabase
      .from('clients')
      .select('id, name, phone, asaasCreditCardToken, asaasCreditCardLast4, asaasCreditCardBrand')
      .eq('id', subscription.clientId)
      .maybeSingle();
    const token = (client as any)?.asaasCreditCardToken || null;
    if (!token) {
      throw new BadRequestException(
        'Cliente não tem cartão salvo para débito direto (maquininha não tokeniza). Use "Gerar cobrança" para enviar o link.',
      );
    }

    const asaasCustomerId = await this.ensureAsaasCustomer(subscription.clientId);
    const today = nowLocalIsoString().split('T')[0];

    let charge: AsaasCharge;
    try {
      charge = await this.asaasService.createCharge({
        customer: asaasCustomerId,
        billingType: AsaasBillingType.CREDIT_CARD,
        value: this.asaasService.centavosToReais(subscription.plan?.price ?? 0),
        dueDate: today,
        description: `Assinatura: Plano ${subscription.plan?.name ?? ''}`.trim(),
        externalReference: subscription.id,
        creditCardToken: token,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Não foi possível cobrar o cartão salvo. (${detail})`);
    }

    // Registra o payment local (idempotente — o webhook pode já ter criado).
    const { data: existingPay } = await this.supabase
      .from('payments')
      .select('id')
      .eq('asaasPaymentId', charge.id)
      .maybeSingle();
    if (!existingPay) {
      const now = nowLocalIsoString();
      await this.supabase.from('payments').insert({
        id: randomUUID(),
        clientId: subscription.clientId,
        subscriptionId: subscription.id,
        amount: subscription.plan?.price ?? 0,
        method: asaasBillingToLocalPaymentMethod(AsaasBillingType.CREDIT_CARD),
        registeredBy: await this.resolveSystemRegisteredBy(),
        notes: `Débito no cartão salvo do ciclo #${charge.id}`,
        asaasPaymentId: charge.id,
        asaasStatus: charge.status,
        paidAt: null, // confirmação vem pelo webhook/sync
        cardLast4: (client as any)?.asaasCreditCardLast4 ?? null,
        cardBrand: (client as any)?.asaasCreditCardBrand ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Cartão tokenizado costuma confirmar na hora → reconcilia já. syncWithAsaas
    // numa ACTIVE com ciclo não pago grava o paidAt e quita SEM renovar a janela.
    let confirmed = false;
    try {
      await this.syncWithAsaas(subscription.id);
      const fresh = await this.findSubscription(subscription.id);
      confirmed = await isCurrentCyclePaid(this.supabase, fresh);
    } catch (e) {
      this.logger.warn(`[charge-card] reconciliação pós-débito falhou (${subscription.id}): ${e}`);
    }

    const cardLast4 = (client as any)?.asaasCreditCardLast4 ?? null;
    const cardBrand = (client as any)?.asaasCreditCardBrand ?? null;
    return {
      charged: true,
      confirmed, // true se já liquidou (cartão aprovado e reconciliado)
      status: charge.status,
      client: {
        name: subscription.client?.name ?? null,
        phone: subscription.client?.phone ?? null,
      },
      planName: subscription.plan?.name ?? null,
      cardLabel: cardLast4 ? `${cardBrand ?? 'Cartão'} •••• ${cardLast4}` : null,
    };
  }

  async forceCharge(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);
    const plan = subscription.plan;
    const client = subscription.client;

    if (!subscription.status || subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Apenas assinaturas ativas podem ser cobradas');
    }

    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não configurada');
    }

    // 1. Obter ou criar customer no Asaas
    const asaasCustomerId = await this.ensureAsaasCustomer(subscription.clientId);

    // 2. Criar cobrança avulsa no Asaas
    const today = nowLocalIsoString().split('T')[0];
    const asaasCharge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: AsaasBillingType.PIX, // Padrão para cobrança forçada
      value: this.asaasService.centavosToReais(plan.price || 0),
      dueDate: today,
      description: `Renovação Manual: Plano ${plan.name}`,
      externalReference: subscriptionId,
    });

    // 3. Registrar pagamento pendente no banco local vinculado à assinatura
    const now = nowLocalIsoString();
    const { data: payment, error } = await this.supabase
      .from('payments')
      .insert({
        id: randomUUID(),
        clientId: subscription.clientId,
        subscriptionId: subscriptionId,
        amount: plan.price,
        method: 'PIX', // Mapeado do Asaas
        asaasPaymentId: asaasCharge.id,
        asaasStatus: asaasCharge.status,
        paidAt: null, // Pendente
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      message: 'Cobrança gerada com sucesso',
      payment,
      asaasCharge,
    };
  }

  /**
   * Sweep das assinaturas canceladas com periodo vigente que ja venceram.
   * Cliente canceou (canceledAt setado) mas mantivemos status ACTIVE ate endDate.
   * Quando endDate passa, finalmente vira CANCELED de fato e perde os beneficios.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireCanceledSubscriptionsCron() {
    const nowIso = new Date().toISOString();
    const { data: expired } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('status', 'ACTIVE')
      .not('canceledAt', 'is', null)
      .lt('endDate', nowIso)
      .limit(200);

    if (!expired || expired.length === 0) return;

    const ids = expired.map((s: any) => s.id);
    const { error } = await this.supabase
      .from('client_subscriptions')
      .update({ status: 'CANCELED', updatedAt: nowLocalIsoString() })
      .in('id', ids);

    if (error) {
      this.logger.warn(`[expire-canceled-cron] falha ao expirar ${ids.length} assinatura(s): ${error.message}`);
      return;
    }
    this.logger.log(`[expire-canceled-cron] ${ids.length} assinatura(s) cancelada(s) ao vencer`);
  }

  /**
   * Sweep das assinaturas ACTIVE NÃO-canceladas que já venceram (endDate passou):
   * suspende-as. Antes, a suspensão de vencidos só ocorria "preguiçosamente" quando
   * o cliente abria o app (findClientSubscription). Sem este cron, uma assinatura
   * vencida ficava gravada como ACTIVE e a tela do cliente mostrava "Plano ativo"
   * SEM opção de renovar/gerar PIX — o cliente precisava pedir ao dono. Suspendendo
   * proativamente, o app já exibe o botão "Reativar assinatura" (que gera PIX).
   * As canceladas vencidas são tratadas por expireCanceledSubscriptionsCron (→ CANCELED).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async suspendExpiredActiveSubscriptionsCron() {
    const nowIso = new Date().toISOString();
    const { data: expired } = await this.supabase
      .from('client_subscriptions')
      .select('id, clientId, endDate, isComp, plan:subscription_plans!planId(name, price)')
      .eq('status', 'ACTIVE')
      .is('canceledAt', null) // canceladas vencidas viram CANCELED no outro cron
      .lt('endDate', nowIso)
      .limit(200);

    if (!expired || expired.length === 0) return;

    const now = nowLocalIsoString();
    let suspended = 0;
    for (const sub of expired as any[]) {
      // Cortesia (grátis) vencida: vira EXPIRED e NÃO gera inadimplência — nunca houve
      // cobrança a pagar. O cliente vê o fluxo normal de renovação PAGA.
      if (sub.isComp) {
        const { error: expErr } = await this.supabase
          .from('client_subscriptions')
          .update({ status: 'EXPIRED', updatedAt: now })
          .eq('id', sub.id);
        if (expErr) {
          this.logger.warn(`[suspend-expired-cron] falha ao expirar cortesia ${sub.id}: ${expErr.message}`);
          continue;
        }
        this.logger.log(`[suspend-expired-cron] cortesia ${sub.id} expirada (sem dívida)`);
        continue;
      }
      const { error } = await this.supabase
        .from('client_subscriptions')
        .update({ status: 'SUSPENDED', updatedAt: now })
        .eq('id', sub.id);
      if (error) {
        this.logger.warn(`[suspend-expired-cron] falha ao suspender ${sub.id}: ${error.message}`);
        continue;
      }
      suspended += 1;
      // Inadimplência confiável SEM depender do webhook OVERDUE do Asaas (que pode não
      // estar configurado/disparando): ao vencer sem pagamento, registra a dívida e marca
      // o cliente como inadimplente. Self-healing: quando o pagamento confirmar,
      // settleOverdueDebtForPayment quita pela mesma régua 'Cobrança não paga%'.
      await this.recordSubscriptionDelinquency(sub).catch((e) =>
        this.logger.warn(`[suspend-expired-cron] falha ao registrar inadimplência de ${sub.id}: ${e}`),
      );
    }

    if (suspended > 0) {
      this.logger.log(`[suspend-expired-cron] ${suspended} assinatura(s) suspensa(s) ao vencer`);
    }
  }

  /**
   * DÉBITO AUTOMÁTICO RECORRENTE no cartão salvo (rede de segurança própria, não
   * depende da recorrência nativa do Asaas — que o histórico mostra falhar). Roda
   * todo dia: para cada assinatura ACTIVE em DIA (ciclo vigente pago) que vence nos
   * próximos LEAD dias e cujo cliente tem cartão tokenizado, cria uma cobrança
   * CREDIT_CARD com o token (autoriza na hora) e AVANÇA o vencimento +1 mês — igual
   * uma assinatura recorrente normal.
   *
   * Blindagens (dinheiro real):
   *  - SÓ renova quem está EM DIA (isCurrentCyclePaid). Ciclo em aberto/inadimplente
   *    NÃO é auto-debitado aqui — segue o fluxo de inadimplência (suspend-cron).
   *  - Idempotência POR VIRADA: se já existe payment lançado para esta virada
   *    (janela [endDate-LEAD-1, endDate]), não recobra — vale p/ sucesso E recusa.
   *  - Cartão recusado → grava um marcador (não recobra) e deixa a inadimplência
   *    normal acontecer quando o vencimento passar.
   *  - Kill switch: env DISABLE_AUTO_CARD_RENEWAL=true desliga o cron.
   *  - Maquininha não tokeniza → sem token, é pulado (recorrência via link/inadimplência).
   */
  @Cron('0 8 * * *') // todo dia às 08:00
  async autoChargeTokenizedRenewalsCron() {
    if (!this.asaasService.configured) return;
    if (this.configService.get('DISABLE_AUTO_CARD_RENEWAL') === 'true') return;

    const LEAD_DAYS = 2;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const nowIso = now.toISOString();
    const windowEndIso = new Date(now.getTime() + LEAD_DAYS * ONE_DAY).toISOString();

    // ACTIVE, não cancelada, vencendo dentro da janela de lead (ainda NÃO vencida —
    // se já venceu, é o suspend-cron que trata).
    const { data: due } = await this.supabase
      .from('client_subscriptions')
      .select('id, clientId, endDate, startDate, createdAt, plan:subscription_plans!planId(id, name, price)')
      .eq('status', 'ACTIVE')
      .is('canceledAt', null)
      .gte('endDate', nowIso)
      .lte('endDate', windowEndIso)
      .limit(200);

    if (!due || due.length === 0) return;

    const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    let charged = 0;

    for (const row of due as any[]) {
      const { data: client } = await this.supabase
        .from('clients')
        .select('asaasCreditCardToken')
        .eq('id', row.clientId)
        .maybeSingle();
      const token = (client as any)?.asaasCreditCardToken;
      if (!token) continue; // sem cartão tokenizado → não dá p/ auto-debitar

      // Idempotência POR VIRADA: já há cobrança lançada nesta janela? (sucesso pendente,
      // pago, ou marcador de recusa). A janela é curta (~3 dias antes do vencimento), então
      // nada de ciclos anteriores cai aqui.
      const sinceIso = new Date(
        new Date(row.endDate).getTime() - (LEAD_DAYS + 1) * ONE_DAY,
      ).toISOString();
      const { data: recent } = await this.supabase
        .from('payments')
        .select('id')
        .eq('subscriptionId', row.id)
        .gte('createdAt', sinceIso)
        .limit(1);
      if (recent && recent.length > 0) continue;

      const subscription = await this.findSubscription(row.id).catch(() => null);
      if (!subscription) continue;

      // SÓ renova quem está EM DIA. Ciclo vigente não pago = inadimplência, não rolagem.
      if (!(await isCurrentCyclePaid(this.supabase, subscription))) continue;

      try {
        const today = nowLocalIsoString().split('T')[0];
        const charge = await this.asaasService.createCharge({
          customer: await this.ensureAsaasCustomer(row.clientId),
          billingType: AsaasBillingType.CREDIT_CARD,
          value: this.asaasService.centavosToReais(row.plan?.price ?? 0),
          dueDate: today,
          description: `Renovação automática: Plano ${row.plan?.name ?? ''}`.trim(),
          externalReference: row.id,
          creditCardToken: token,
        });

        if (SETTLED.includes(charge.status)) {
          // Cartão autorizou na hora → grava o pagamento (paidAt + caixa) e RENOVA a
          // janela +1 mês. Não espera o webhook (que, se vier, é idempotente).
          if (!charge.confirmedDate && !charge.paymentDate) charge.confirmedDate = today;
          await this.upsertLocalPaymentFromCharge(subscription, charge, true);

          const currentEnd = subscription.endDate ? new Date(subscription.endDate) : now;
          const base = currentEnd > now ? currentEnd : now;
          const newEnd = new Date(base);
          newEnd.setMonth(newEnd.getMonth() + 1);
          await this.supabase
            .from('client_subscriptions')
            .update({
              cutsUsedThisMonth: 0,
              lastResetDate: now.toISOString(),
              endDate: newEnd.toISOString(),
              updatedAt: now.toISOString(),
            })
            .eq('id', row.id);
          await this.settleSubscriptionDelinquencyDebts(subscription, charge.id).catch(() => {});
          charged += 1;
        } else {
          // Criada mas não liquidou na hora (raro p/ cartão) → registra pendente; o
          // webhook confirma e renova depois (caminho normal).
          await this.upsertLocalPaymentFromCharge(subscription, charge, false);
        }
      } catch (e) {
        // Cartão recusado / falha. Grava um MARCADOR (asaasStatus DECLINED, sem paidAt)
        // só p/ a idempotência não recobrar a mesma virada. A inadimplência acontece
        // pelo suspend-cron quando o vencimento passar (dívida + suspensão).
        this.logger.warn(`[auto-card-renew] falha ao debitar o cartão da assinatura ${row.id}: ${e}`);
        const ts = nowLocalIsoString();
        await this.supabase
          .from('payments')
          .insert({
            id: randomUUID(),
            clientId: row.clientId,
            subscriptionId: row.id,
            amount: row.plan?.price ?? 0,
            method: asaasBillingToLocalPaymentMethod(AsaasBillingType.CREDIT_CARD),
            registeredBy: await this.resolveSystemRegisteredBy().catch(() => null),
            notes: 'Débito automático no cartão recusado',
            asaasStatus: 'DECLINED',
            paidAt: null,
            createdAt: ts,
            updatedAt: ts,
          })
          .then(undefined, () => {});
      }
    }

    if (charged > 0) {
      this.logger.log(`[auto-card-renew] ${charged} assinatura(s) renovada(s) automaticamente no cartão salvo`);
    }
  }

  /**
   * Registra a inadimplência de uma assinatura vencida sem pagamento: cria a dívida
   * e marca clients.hasDebts. Idempotente POR CLIENTE — não empilha com a dívida do
   * webhook OVERDUE (ambas usam o rótulo 'Cobrança não paga'), evitando valor em dobro.
   * A forma de cobrança esperada (PIX/cartão/dinheiro) vai na descrição, pro admin
   * resolver mais fácil. A tag [sub:<id>:cycle:<endDate>] identifica o ciclo.
   */
  private async recordSubscriptionDelinquency(sub: {
    id: string;
    clientId: string;
    endDate: string | null;
    plan?: { name?: string; price?: number } | null;
  }): Promise<void> {
    if (!sub.clientId) return;

    // Dedup: cliente já tem cobrança de assinatura em aberto (criada aqui ou pelo
    // webhook OVERDUE) → não cria outra.
    const { data: openDebts } = await this.supabase
      .from('debts')
      .select('id')
      .eq('clientId', sub.clientId)
      .eq('isSettled', false)
      .ilike('description', 'Cobrança não paga%')
      .limit(1);
    if (openDebts && openDebts.length > 0) return;

    const amount = sub.plan?.price ?? 0;
    if (amount <= 0) return;

    const planName = sub.plan?.name ?? 'Assinatura';
    const method = await this.resolveExpectedChargeMethod(sub.id);
    const cycleKey = String(sub.endDate ?? '').substring(0, 10);
    const now = nowLocalIsoString();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const { error: debtError } = await this.supabase.from('debts').insert({
      id: randomUUID(),
      clientId: sub.clientId,
      amount,
      amountPaid: 0,
      remainingBalance: amount,
      description: `Cobrança não paga — ${planName} (${method}) [sub:${sub.id}:cycle:${cycleKey}]`,
      dueDate: dueDate.toISOString(),
      isSettled: false,
      createdAt: now,
      updatedAt: now,
    });

    if (debtError) {
      this.logger.error(
        `[suspend-expired-cron] falha ao criar dívida da assinatura ${sub.id}: ${JSON.stringify(debtError)}`,
      );
      return;
    }

    await this.supabase.from('clients').update({ hasDebts: true }).eq('id', sub.clientId);
    this.logger.warn(
      `[suspend-expired-cron] assinatura ${sub.id} inadimplente — dívida ${amount} (${method}) criada para cliente ${sub.clientId}`,
    );
  }

  /** Forma de cobrança esperada (PIX/Cartão/Dinheiro) a partir do último pagamento da assinatura. */
  private async resolveExpectedChargeMethod(subscriptionId: string): Promise<string> {
    const { data: pays } = await this.supabase
      .from('payments')
      .select('method, createdAt')
      .eq('subscriptionId', subscriptionId)
      .order('createdAt', { ascending: false })
      .limit(1);
    const m = (pays && (pays[0] as any)?.method) || 'PIX';
    if (m === 'CARD') return 'Cartão';
    if (m === 'CASH') return 'Dinheiro';
    return 'PIX';
  }

  /**
   * Lista assinaturas ACTIVE que nunca tiveram pagamento confirmado.
   *
   * Caça o legado do bug "nascia ACTIVE sem pagamento" (Asaas off, até fbfe8ed):
   * assinaturas ativas de graça que parecem "renovadas sem cobrança". PostgREST não
   * faz NOT EXISTS, então buscamos as ACTIVE e o conjunto de subscriptionId já pagos
   * e filtramos em memória.
   */
  async findActiveWithoutPayment(): Promise<
    Array<{
      id: string;
      clientId: string;
      clientName: string | null;
      planName: string | null;
      price: number | null;
      startDate: string | null;
      endDate: string | null;
    }>
  > {
    const { data: actives } = await this.supabase
      .from('client_subscriptions')
      .select('id, clientId, startDate, endDate, client:clients(name), plan:subscription_plans!planId(name, price)')
      .eq('status', 'ACTIVE');

    if (!actives || actives.length === 0) return [];

    const { data: paidRows } = await this.supabase
      .from('payments')
      .select('subscriptionId')
      .not('paidAt', 'is', null)
      .not('subscriptionId', 'is', null);

    const paidSubIds = new Set((paidRows || []).map((p: any) => p.subscriptionId));

    return (actives as any[])
      .filter((s) => !paidSubIds.has(s.id))
      .map((s) => ({
        id: s.id,
        clientId: s.clientId,
        clientName: s.client?.name ?? null,
        planName: s.plan?.name ?? null,
        price: s.plan?.price ?? null,
        startDate: s.startDate ?? null,
        endDate: s.endDate ?? null,
      }));
  }

  /**
   * Suspende todas as assinaturas ACTIVE sem pagamento confirmado (legado).
   * Vira SUSPENDED → cliente vê "Reativar assinatura" e precisa pagar p/ continuar.
   * Idempotente: rodar de novo com a lista vazia não faz nada.
   */
  async suspendActiveWithoutPayment(): Promise<{
    suspended: number;
    items: Awaited<ReturnType<SubscriptionsService['findActiveWithoutPayment']>>;
  }> {
    const items = await this.findActiveWithoutPayment();
    if (items.length === 0) return { suspended: 0, items: [] };

    const ids = items.map((i) => i.id);
    const { error } = await this.supabase
      .from('client_subscriptions')
      .update({ status: 'SUSPENDED', updatedAt: nowLocalIsoString() })
      .in('id', ids);

    if (error) {
      this.logger.error(`[suspend-unpaid] falha ao suspender ${ids.length} assinatura(s): ${error.message}`);
      throw new BadRequestException(`Falha ao suspender assinaturas: ${error.message}`);
    }

    this.logger.warn(`[suspend-unpaid] ${ids.length} assinatura(s) ACTIVE sem pagamento suspensa(s).`);
    return { suspended: ids.length, items };
  }

  /**
   * Cron de reconciliação: a cada 10 minutos varre todas as assinaturas
   * em PENDING_PAYMENT e tenta sincronizar com o Asaas.
   *
   * Cobre o cenário "cliente pagou PIX, Asaas confirmou, webhook nunca chegou
   * (token errado, rede, servidor fora do ar) e o cliente nunca abriu o app".
   * Sem este cron a assinatura ficaria presa até alguém olhar.
   */
  /**
   * Gera relatorio de cobrancas Asaas confirmadas/recebidas nos ultimos N dias
   * que estao desalinhadas com o estado local. Lista 3 tipos de problema:
   *  - PAYMENT_MISSING: Asaas confirmou mas nao existe linha em payments
   *  - PAYMENT_UNPAID: existe linha mas paidAt esta NULL
   *  - APPOINTMENT_CANCELED: pagamento liga a um appointment que foi cancelado
   * O admin revisa cada linha e clica "Resolver" para aplicar o fix.
   */
  async getAsaasReconciliationReport(daysBack: number = 7): Promise<{
    configured: boolean;
    issues: Array<{
      asaasPaymentId: string;
      asaasStatus: string;
      amount: number;
      confirmedAt: string | null;
      issue: 'PAYMENT_MISSING' | 'PAYMENT_UNPAID' | 'APPOINTMENT_CANCELED';
      kind: 'subscription' | 'appointment' | 'unknown';
      clientId: string | null;
      clientName: string | null;
      description: string;
      suggestedAction: string;
    }>;
  }> {
    if (!this.asaasService.configured) {
      return { configured: false, issues: [] };
    }

    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, daysBack));
    const dateCreatedGe = since.toISOString().split('T')[0];

    const [recv, conf] = await Promise.all([
      this.asaasService
        .getPayments({ status: 'RECEIVED', 'dateCreated[ge]': dateCreatedGe, limit: 100 })
        .catch(() => ({ data: [] as any[] })),
      this.asaasService
        .getPayments({ status: 'CONFIRMED', 'dateCreated[ge]': dateCreatedGe, limit: 100 })
        .catch(() => ({ data: [] as any[] })),
    ]);

    const charges = [...((recv as any).data || []), ...((conf as any).data || [])];
    if (charges.length === 0) return { configured: true, issues: [] };

    const issues: any[] = [];

    for (const charge of charges) {
      const asaasPaymentId = charge.id;
      const amount = Math.round(Number(charge.value || 0) * 100);
      const confirmedAt =
        charge.confirmedDate || charge.clientPaymentDate || charge.paymentDate || null;
      const externalRef: string | undefined = charge.externalReference;

      const { data: localPayment } = await this.supabase
        .from('payments')
        .select('id, paidAt, subscriptionId, appointmentId')
        .eq('asaasPaymentId', asaasPaymentId)
        .maybeSingle();

      if (!localPayment) {
        const ctx = await this.resolveChargeContext(externalRef);
        issues.push({
          asaasPaymentId,
          asaasStatus: charge.status,
          amount,
          confirmedAt,
          issue: 'PAYMENT_MISSING',
          kind: ctx.kind,
          clientId: ctx.clientId,
          clientName: ctx.clientName,
          description: ctx.description || `Cobrança ${asaasPaymentId.slice(0, 12)}`,
          suggestedAction:
            ctx.kind === 'subscription'
              ? 'Registrar pagamento e ativar assinatura'
              : ctx.kind === 'appointment'
              ? 'Registrar pagamento e marcar agendamento como pago'
              : 'Registrar pagamento (sem vínculo)',
        });
        continue;
      }

      if (!(localPayment as any).paidAt) {
        const ctx = await this.resolveChargeContext(externalRef, localPayment);
        issues.push({
          asaasPaymentId,
          asaasStatus: charge.status,
          amount,
          confirmedAt,
          issue: 'PAYMENT_UNPAID',
          kind: ctx.kind,
          clientId: ctx.clientId,
          clientName: ctx.clientName,
          description: ctx.description || `Cobrança ${asaasPaymentId.slice(0, 12)}`,
          suggestedAction: 'Marcar pagamento como pago',
        });
        continue;
      }

      if ((localPayment as any).appointmentId) {
        const { data: appt } = await this.supabase
          .from('appointments')
          .select('id, status, clientId, scheduledAt, client:clients(name)')
          .eq('id', (localPayment as any).appointmentId)
          .maybeSingle();
        if (appt && (appt as any).status === 'CANCELED') {
          const clientName = (appt as any).client?.name || null;
          const date = (appt as any).scheduledAt
            ? new Date((appt as any).scheduledAt).toLocaleDateString('pt-BR')
            : '?';
          issues.push({
            asaasPaymentId,
            asaasStatus: charge.status,
            amount,
            confirmedAt,
            issue: 'APPOINTMENT_CANCELED',
            kind: 'appointment',
            clientId: (appt as any).clientId,
            clientName,
            description: `Agendamento ${date}${clientName ? ' — ' + clientName : ''}`,
            suggestedAction:
              'Registrar pagamento (agendamento fica cancelado — decida à parte se estorna ou reagenda)',
          });
        }
      }
    }

    return { configured: true, issues };
  }

  private async resolveChargeContext(
    externalRef?: string,
    localPayment?: any,
  ): Promise<{
    kind: 'subscription' | 'appointment' | 'unknown';
    clientId: string | null;
    clientName: string | null;
    description: string | null;
  }> {
    const refSub = localPayment?.subscriptionId || externalRef;
    if (refSub) {
      const { data: sub } = await this.supabase
        .from('client_subscriptions')
        .select('clientId, plan:subscription_plans!planId(name), client:clients(name)')
        .eq('id', refSub)
        .maybeSingle();
      if (sub) {
        const clientName = (sub as any).client?.name || null;
        const planName = (sub as any).plan?.name || 'Assinatura';
        return {
          kind: 'subscription',
          clientId: (sub as any).clientId,
          clientName,
          description: `${planName}${clientName ? ' — ' + clientName : ''}`,
        };
      }
    }
    const refAppt = localPayment?.appointmentId;
    if (refAppt) {
      const { data: appt } = await this.supabase
        .from('appointments')
        .select('clientId, scheduledAt, client:clients(name)')
        .eq('id', refAppt)
        .maybeSingle();
      if (appt) {
        const clientName = (appt as any).client?.name || null;
        const date = (appt as any).scheduledAt
          ? new Date((appt as any).scheduledAt).toLocaleDateString('pt-BR')
          : '?';
        return {
          kind: 'appointment',
          clientId: (appt as any).clientId,
          clientName,
          description: `Agendamento ${date}${clientName ? ' — ' + clientName : ''}`,
        };
      }
    }
    return { kind: 'unknown', clientId: null, clientName: null, description: null };
  }

  /**
   * Aplica a correcao para uma cobranca Asaas especifica. Faz o fix correto
   * (criar payment, marcar como pago, restaurar agendamento ou ativar assinatura)
   * baseado no estado local. Idempotente.
   */
  async applyAsaasReconciliation(asaasPaymentId: string): Promise<{
    success: boolean;
    action: string;
    message: string;
  }> {
    if (!this.asaasService.configured) {
      return { success: false, action: 'NONE', message: 'Asaas não está configurado' };
    }

    let charge: any;
    try {
      charge = await this.asaasService.getCharge(asaasPaymentId);
    } catch (e: any) {
      return { success: false, action: 'NONE', message: `Cobrança não encontrada no Asaas: ${e?.message || e}` };
    }

    const validStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    if (!validStatuses.includes(charge.status)) {
      return {
        success: false,
        action: 'NONE',
        message: `Cobrança não está confirmada no Asaas (status=${charge.status}). Aguarde a confirmação antes de reconciliar.`,
      };
    }

    const externalRef: string | undefined = charge.externalReference;
    const amount = Math.round(Number(charge.value || 0) * 100);
    const confirmedAt =
      charge.confirmedDate || charge.clientPaymentDate || charge.paymentDate || nowLocalIsoString();
    const now = nowLocalIsoString();
    const billingType = charge.billingType || 'PIX';
    const localMethod = billingType === 'CREDIT_CARD' ? 'CARD' : 'PIX';

    let subscriptionId: string | null = null;
    let appointmentId: string | null = null;
    let clientId: string | null = null;

    if (externalRef) {
      const { data: sub } = await this.supabase
        .from('client_subscriptions')
        .select('id, clientId')
        .eq('id', externalRef)
        .maybeSingle();
      if (sub) {
        subscriptionId = (sub as any).id;
        clientId = (sub as any).clientId;
      } else {
        const { data: appt } = await this.supabase
          .from('appointments')
          .select('id, clientId')
          .eq('id', externalRef)
          .maybeSingle();
        if (appt) {
          appointmentId = (appt as any).id;
          clientId = (appt as any).clientId;
        }
      }
    }

    const { data: existingPayment } = await this.supabase
      .from('payments')
      .select('id, paidAt, appointmentId, subscriptionId, clientId')
      .eq('asaasPaymentId', asaasPaymentId)
      .maybeSingle();

    let paymentId: string;
    if (existingPayment) {
      paymentId = (existingPayment as any).id;
      if (!(existingPayment as any).paidAt) {
        await this.supabase
          .from('payments')
          .update({ paidAt: confirmedAt, asaasStatus: charge.status, updatedAt: now })
          .eq('id', paymentId);
      }
      subscriptionId = subscriptionId || (existingPayment as any).subscriptionId || null;
      appointmentId = appointmentId || (existingPayment as any).appointmentId || null;
      clientId = clientId || (existingPayment as any).clientId || null;
    } else {
      // registeredBy e NOT NULL: usa o primeiro admin como registrante "sistema"
      const { data: systemAdmin } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .limit(1)
        .maybeSingle();
      if (!systemAdmin) {
        return {
          success: false,
          action: 'NONE',
          message: 'Nenhum admin encontrado para registrar o pagamento. Crie um usuario admin antes.',
        };
      }

      paymentId = randomUUID();
      const { error: insertError } = await this.supabase.from('payments').insert({
        id: paymentId,
        clientId,
        subscriptionId,
        appointmentId,
        amount,
        method: localMethod,
        registeredBy: systemAdmin.id,
        notes: `Reconciliação manual (cobrança ${asaasPaymentId})`,
        asaasPaymentId,
        asaasStatus: charge.status,
        paidAt: confirmedAt,
        invoiceUrl: charge.invoiceUrl || null,
        bankSlipUrl: charge.bankSlipUrl || null,
        createdAt: now,
        updatedAt: now,
      });
      if (insertError) {
        return { success: false, action: 'NONE', message: `Falha ao criar pagamento: ${insertError.message}` };
      }
    }

    // Data contábil + vínculo ao caixa (espelha o webhook handlePaymentConfirmed):
    // dia do atendimento quando há agendamento; senão dia da confirmação. Gravado
    // de forma idempotente (cobre tanto o payment novo quanto o pré-existente sem
    // businessDate). Se o caixa do dia já estiver fechado, é recalculado.
    let reconScheduledAt: string | null = null;
    if (appointmentId) {
      const { data: appt } = await this.supabase
        .from('appointments')
        .select('scheduledAt')
        .eq('id', appointmentId)
        .maybeSingle();
      reconScheduledAt = (appt as any)?.scheduledAt ?? null;
    }
    const reconBusinessDate = resolveBusinessDate(reconScheduledAt, confirmedAt);
    await this.supabase
      .from('payments')
      .update({ businessDate: reconBusinessDate, updatedAt: now })
      .eq('id', paymentId);
    await this.cashRegisterService.linkPaymentToBusinessDateRegister(
      paymentId,
      reconBusinessDate,
    );

    if (subscriptionId) {
      const { data: sub } = await this.supabase
        .from('client_subscriptions')
        .select('id, status, endDate')
        .eq('id', subscriptionId)
        .maybeSingle();
      if (sub && (sub as any).status !== 'ACTIVE') {
        // 1ª ativação (status não-ACTIVE): ciclo começa no pagamento → agora + 1 mês.
        // Não reaproveitar o endDate da criação (já era "agora + 1 mês" → inflaria).
        const newEnd = new Date();
        newEnd.setMonth(newEnd.getMonth() + 1);
        await this.supabase
          .from('client_subscriptions')
          .update({
            status: 'ACTIVE',
            endDate: newEnd.toISOString(),
            cutsUsedThisMonth: 0,
            lastResetDate: now,
            isComp: false, // ativação por pagamento Asaas → não é mais cortesia
            updatedAt: now,
          })
          .eq('id', subscriptionId);
        return { success: true, action: 'SUBSCRIPTION_ACTIVATED', message: 'Assinatura ativada e pagamento registrado.' };
      }
      return { success: true, action: 'PAYMENT_REGISTERED', message: 'Pagamento registrado.' };
    }

    if (appointmentId) {
      const { data: appt } = await this.supabase
        .from('appointments')
        .select('id, status')
        .eq('id', appointmentId)
        .maybeSingle();
      // Agendamento ja cancelado: nao restaura nem marca como pago. Apenas registra
      // o pagamento (ja foi feito acima). Admin decide a parte se estorna ou reagenda.
      if (appt && (appt as any).status === 'CANCELED') {
        return {
          success: true,
          action: 'PAYMENT_REGISTERED_APPOINTMENT_CANCELED',
          message:
            'Pagamento registrado. O agendamento permanece cancelado — decida à parte se restaura, reagenda ou estorna o cliente.',
        };
      }
      await this.supabase
        .from('appointments')
        .update({ isPaid: true, paymentId, updatedAt: now })
        .eq('id', appointmentId);
      return { success: true, action: 'APPOINTMENT_MARKED_PAID', message: 'Agendamento marcado como pago.' };
    }

    return { success: true, action: 'PAYMENT_REGISTERED', message: 'Pagamento registrado (sem vínculo).' };
  }

  /**
   * Reconciliacao on-demand das assinaturas PENDING_PAYMENT com o Asaas.
   * Mesma logica do cron, mas pode ser acionada pelo admin para forcar a
   * verificacao na hora (ex.: cliente reclamou que pagou e nada apareceu).
   * Retorna estatisticas do que foi processado.
   */
  async reconcilePendingWithAsaas(): Promise<{ checked: number; activated: number; errors: number; configured: boolean }> {
    if (!this.asaasService.configured) {
      return { checked: 0, activated: 0, errors: 0, configured: false };
    }

    const items = await this.collectReconcilableSubscriptions();
    if (items.length === 0) {
      return { checked: 0, activated: 0, errors: 0, configured: true };
    }

    let activated = 0;
    let errors = 0;
    for (const sub of items) {
      try {
        const before = await this.findSubscription(sub.id).catch(() => null);
        if (!before) continue;
        const wasActiveBefore = before.status === 'ACTIVE';
        const after = await this.syncWithAsaas(sub.id);
        if (after?.status === 'ACTIVE' && !wasActiveBefore) {
          activated += 1;
        }
      } catch (e) {
        errors += 1;
        this.logger.warn(`[reconcile-manual] falha em ${sub.id}: ${e}`);
      }
    }

    this.logger.log(
      `[reconcile-manual] checked=${items.length} activated=${activated} errors=${errors}`,
    );
    return { checked: items.length, activated, errors, configured: true };
  }

  /**
   * Alvos da reconciliação automática com o Asaas (cron + botão "Reconciliar com Asaas"):
   * assinaturas cujo pagamento pode ter sido confirmado no Asaas SEM o webhook chegar.
   *  - PENDING_PAYMENT: aguardando a 1ª confirmação (sempre incluída).
   *  - SUSPENDED recente: renovação recorrente PAGA cujo webhook se perdeu → o vencimento
   *    passou e o cron suspendeu (caso Eduardo Ventura: pagou o PIX, ficou "Encerrada +
   *    Inadimplente"). syncWithAsaas já sabe reativar a partir de uma cobrança paga; o que
   *    faltava era ALIMENTAR a varredura com as SUSPENDED. Limitado à janela de recência
   *    (updatedAt) p/ não reprocessar churn antigo a cada 10 min (custo de chamadas Asaas);
   *    SUSPENDED antiga segue recuperável sob demanda pelo POST /subscriptions/:id/sync-asaas.
   */
  private async collectReconcilableSubscriptions(): Promise<
    Array<{ id: string; clientId: string }>
  > {
    const { data: pending } = await this.supabase
      .from('client_subscriptions')
      .select('id, clientId')
      .eq('status', 'PENDING_PAYMENT')
      .limit(200);

    const cutoffIso = new Date(
      Date.now() -
        SubscriptionsService.RECONCILE_SUSPENDED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: suspended } = await this.supabase
      .from('client_subscriptions')
      .select('id, clientId')
      .eq('status', 'SUSPENDED')
      .gte('updatedAt', cutoffIso)
      .limit(200);

    const byId = new Map<string, { id: string; clientId: string }>();
    for (const s of [...(pending || []), ...(suspended || [])]) {
      byId.set(s.id, { id: s.id, clientId: s.clientId });
    }
    return Array.from(byId.values());
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcilePendingSubscriptionsCron() {
    if (!this.asaasService.configured) return;

    const pending = await this.collectReconcilableSubscriptions();

    if (!pending || pending.length === 0) return;

    this.logger.log(
      `[reconcile-cron] verificando ${pending.length} assinatura(s) (PENDING_PAYMENT + SUSPENDED recentes)`,
    );

    let activated = 0;
    for (const sub of pending) {
      try {
        const before = await this.findSubscription(sub.id).catch(() => null);
        if (!before) continue;
        const wasActiveBefore = before.status === 'ACTIVE';
        const after = await this.syncWithAsaas(sub.id);
        if (after?.status === 'ACTIVE' && !wasActiveBefore) {
          activated += 1;
        }
      } catch (e) {
        this.logger.warn(`[reconcile-cron] falha em ${sub.id}: ${e}`);
      }
    }

    if (activated > 0) {
      this.logger.log(`[reconcile-cron] ${activated} assinatura(s) ativada(s) retroativamente`);
    }
  }
}

