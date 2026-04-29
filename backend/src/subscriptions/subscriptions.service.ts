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
import { AsaasService } from '../asaas/asaas.service';
import {
  AsaasBillingType,
  AsaasSubscriptionCycle,
  asaasBillingToLocalPaymentMethod,
  parseAsaasBillingType,
} from '../asaas/asaas.types';
import {
  CreatePlanDto,
  UpdatePlanDto,
  SubscribeClientDto,
  SubscribeMeDto,
  ReactivateMeDto,
} from './dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
    private readonly configService: ConfigService,
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
      createdAt: new Date().toISOString(),
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
    const now = new Date().toISOString();
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
      .select('*, subscriptions:client_subscriptions(id), services:subscription_plan_services(id, serviceId, discountPercent, service:services(id, name, price))')
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

    // Se Asaas está configurado, aguarda confirmação de pagamento antes de ativar
    const initialStatus = this.asaasService.configured ? 'PENDING_PAYMENT' : 'ACTIVE';
    const subNow = new Date().toISOString();

    // Tenta encontrar uma assinatura cancelada para reutilizar o registro (devido à restrição UNIQUE no clientId)
    const { data: existingSub } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('clientId', dto.clientId)
      .limit(1)
      .single();

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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
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

    return resolved;
  }

  async subscribe(dto: SubscribeClientDto) {
    return this.subscribeClient(dto);
  }

  async findSubscription(id: string) {
    const { data: subscription, error } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .order('createdAt', { ascending: false });

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: subscriptions, error } = await queryBuilder;

    if (error) throw error;
    return subscriptions || [];
  }


  async findClientSubscription(clientId: string) {
    // Usa neq em vez de in para evitar problemas se novos valores do enum ainda
    // não tiverem sido adicionados ao banco (PENDING_PAYMENT, SUSPENDED)
    const { data: results } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('clientId', clientId)
      .order('createdAt', { ascending: false })
      .limit(1);

    let subscription: any = results?.[0] ?? null;

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
        const now = new Date().toISOString();
        const { data: suspended } = await this.supabase
          .from('client_subscriptions')
          .update({ status: 'SUSPENDED', updatedAt: now })
          .eq('id', subscription.id)
          .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
          .single();
        this.logger.log(`Assinatura ${subscription.id} suspensa automaticamente (endDate ${subscription.endDate} vencido)`);
        return suspended ?? subscription;
      }
    }

    // Auto-cancelar se PENDING_PAYMENT e endDate já venceu (nunca pagou)
    if (subscription && subscription.status === 'PENDING_PAYMENT') {
      const endDate = new Date(subscription.endDate);
      if (new Date() > endDate) {
        const now = new Date().toISOString();
        const { data: canceled } = await this.supabase
          .from('client_subscriptions')
          .update({ status: 'CANCELED', updatedAt: now })
          .eq('id', subscription.id)
          .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
          .single();
        this.logger.log(`Assinatura ${subscription.id} cancelada automaticamente (PENDING_PAYMENT expirado, endDate ${subscription.endDate})`);
        return canceled ?? subscription;
      }
    }

    return subscription;
  }

  async cancelSubscription(id: string) {
    const { data: subscription, error: findError } = await this.supabase
      .from('client_subscriptions')
      .select('id, status, asaasSubscriptionId')
      .eq('id', id)
      .single();

    if (findError || !subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    if (!['ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED'].includes(subscription.status)) {
      throw new BadRequestException('Assinatura não pode ser cancelada');
    }

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ status: 'CANCELED' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Cancelar assinatura no Asaas (se vinculada)
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

  async useCut(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    // Segurança: verificar se endDate não venceu
    if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
      const now = new Date().toISOString();
      await this.supabase
        .from('client_subscriptions')
        .update({ status: 'SUSPENDED', updatedAt: now })
        .eq('id', subscription.id);
      throw new BadRequestException('Assinatura vencida. Realize o pagamento para renovar os créditos.');
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) throw error;
    return updated;
  }

  async resetCuts(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ cutsUsedThisMonth: 0, lastResetDate: now })
      .eq('id', subscription.id)
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
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
  async confirmPaymentManually(subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId);

    if (subscription.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Apenas assinaturas aguardando pagamento podem ser confirmadas manualmente');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Se endDate já venceu, renovar para now + 1 mês
    let newEndDate: Date;
    if (subscription.endDate && new Date(subscription.endDate) > now) {
      newEndDate = new Date(subscription.endDate);
    } else {
      newEndDate = new Date(now);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    }

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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) throw error;

    this.logger.log(`Assinatura ${subscription.id} confirmada manualmente (admin) — status ACTIVE até ${newEndDate.toISOString()}`);
    return updated;
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
    if (subscription.status === 'ACTIVE' || subscription.status === 'CANCELED') {
      return subscription;
    }

    const charges = await this.collectAsaasChargesForSubscription(subscription);
    if (charges.length === 0) return subscription;

    const paid = charges.find((c: any) =>
      c.status === 'RECEIVED' || c.status === 'CONFIRMED' || c.status === 'RECEIVED_IN_CASH',
    );

    if (!paid) {
      // Sem cobrança paga; reflete o último status conhecido no payments local (best-effort)
      await this.upsertLocalPaymentFromCharge(subscription, charges[0]).catch(() => {});
      return subscription;
    }

    this.logger.warn(
      `[sync-asaas] Assinatura ${subscription.id} estava ${subscription.status} mas Asaas mostra cobrança ${paid.id} como ${paid.status}. Ativando retroativamente.`,
    );

    await this.upsertLocalPaymentFromCharge(subscription, paid, true);

    const now = new Date();
    const currentEnd = subscription.endDate ? new Date(subscription.endDate) : now;
    const baseDate = currentEnd < now ? now : currentEnd;
    const newEndDate = new Date(baseDate);
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .single();

    if (error) {
      this.logger.error(`[sync-asaas] Falha ao ativar assinatura ${subscription.id}: ${error.message}`);
      throw error;
    }

    this.logger.log(`[sync-asaas] Assinatura ${subscription.id} ativada via reconciliação (cobrança ${paid.id}).`);
    return updated;
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
   * Insere ou atualiza o registro local de payment a partir de uma cobrança Asaas.
   * Se markPaid=true, marca paidAt=now.
   */
  private async upsertLocalPaymentFromCharge(subscription: any, charge: any, markPaid = false) {
    const now = new Date().toISOString();
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

    if (existing) {
      const update: any = { asaasStatus: charge.status, updatedAt: now };
      if (markPaid && !existing.paidAt) update.paidAt = now;
      await this.supabase.from('payments').update(update).eq('id', existing.id);
      return existing.id;
    }

    const id = randomUUID();
    await this.supabase.from('payments').insert({
      id,
      clientId: subscription.clientId,
      subscriptionId: subscription.id,
      amount,
      method: localMethod,
      registeredBy: subscription.clientId,
      notes: `Reconciliação Asaas (cobrança ${charge.id})`,
      asaasPaymentId: charge.id,
      asaasStatus: charge.status,
      paidAt: markPaid ? now : null,
      invoiceUrl: charge.invoiceUrl || null,
      bankSlipUrl: charge.bankSlipUrl || null,
      createdAt: now,
      updatedAt: now,
    });
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

    const today = new Date().toISOString().split('T')[0];
    const charge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: AsaasBillingType.PIX,
      value: this.asaasService.centavosToReais(planPrice),
      dueDate: today,
      description: `Plano ${planName} (PIX regenerado)`,
      externalReference: subscription.id,
    });

    const now = new Date().toISOString();
    await this.supabase.from('payments').insert({
      id: randomUUID(),
      clientId,
      subscriptionId: subscription.id,
      amount: planPrice,
      method: asaasBillingToLocalPaymentMethod(AsaasBillingType.PIX),
      registeredBy: clientId,
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

        const today = new Date().toISOString().split('T')[0];
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
        const charge = await this.asaasService.createCharge({
          customer: asaasCustomerId,
          billingType: effectiveBilling,
          value: this.asaasService.centavosToReais(freshSub.plan?.price ?? 0),
          dueDate: today,
          description: `Plano ${freshSub.plan?.name ?? 'Assinatura'}`,
          externalReference: freshSub.id,
          creditCard: body.creditCard,
          creditCardHolderInfo: body.creditCardHolderInfo,
          remoteIp: body.remoteIp,
          callback: {
            successUrl: `${frontendUrl}/planos`,
            autoRedirect: true,
          },
        });

        invoiceUrl = charge.invoiceUrl || null;
        const now = new Date().toISOString();
        const localMethod = asaasBillingToLocalPaymentMethod(effectiveBilling);

        // Inserir registro de pagamento (antes do QR Code para garantir persistência)
        await this.supabase.from('payments').insert({
          id: randomUUID(),
          clientId,
          subscriptionId: freshSub.id,
          amount: freshSub.plan?.price ?? 0,
          method: localMethod,
          registeredBy: clientId,
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
          .update({ status: 'CANCELED', updatedAt: new Date().toISOString() })
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

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ status: 'CANCELED', updatedAt: new Date().toISOString() })
      .eq('id', subscription.id)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Erro ao cancelar assinatura ${subscription.id}: ${JSON.stringify(error)}`);
      throw error;
    }

    // Cancelar assinatura no Asaas (se vinculada)
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
      .select('*, client:clients(id, name, phone, asaasCustomerId, email), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
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
        updatedAt: now.toISOString(),
      })
      .eq('id', subscription.id);

    // Gerar cobrança via Asaas (se configurado)
    let pixData: any = null;
    let invoiceUrl: string | null = null;
    if (this.asaasService.configured) {
      try {
        const asaasCustomerId = await this.ensureAsaasCustomer(clientId);

        const today = now.toISOString().split('T')[0];
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
        const charge = await this.asaasService.createCharge({
          customer: asaasCustomerId,
          billingType,
          value: this.asaasService.centavosToReais(subscription.plan?.price ?? 0),
          dueDate: today,
          description: `Reativação: Plano ${subscription.plan?.name}`,
          externalReference: subscription.id,
          creditCard: body.creditCard,
          creditCardHolderInfo: body.creditCardHolderInfo,
          remoteIp: body.remoteIp,
          callback: {
            successUrl: `${frontendUrl}/planos`,
            autoRedirect: true,
          },
        });

        invoiceUrl = charge.invoiceUrl || null;
        const localMethod = asaasBillingToLocalPaymentMethod(billingType);

        // Inserir registro de pagamento (antes do QR Code para garantir persistência)
        await this.supabase.from('payments').insert({
          id: randomUUID(),
          clientId,
          subscriptionId: subscription.id,
          amount: subscription.plan?.price ?? 0,
          method: localMethod,
          registeredBy: clientId,
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
      .eq('id', subscription.id)
      .single();

    if (!updated && subscription) {
        // Fallback para o objeto original se o re-fetch falhar
        return { subscription, pixData, invoiceUrl };
    }

    return { subscription: updated, pixData, invoiceUrl };
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
    const today = new Date().toISOString().split('T')[0];
    const asaasCharge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: AsaasBillingType.PIX, // Padrão para cobrança forçada
      value: this.asaasService.centavosToReais(plan.price || 0),
      dueDate: today,
      description: `Renovação Manual: Plano ${plan.name}`,
      externalReference: subscriptionId,
    });

    // 3. Registrar pagamento pendente no banco local vinculado à assinatura
    const now = new Date().toISOString();
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
   * Cron de reconciliação: a cada 10 minutos varre todas as assinaturas
   * em PENDING_PAYMENT e tenta sincronizar com o Asaas.
   *
   * Cobre o cenário "cliente pagou PIX, Asaas confirmou, webhook nunca chegou
   * (token errado, rede, servidor fora do ar) e o cliente nunca abriu o app".
   * Sem este cron a assinatura ficaria presa até alguém olhar.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcilePendingSubscriptionsCron() {
    if (!this.asaasService.configured) return;

    const { data: pending } = await this.supabase
      .from('client_subscriptions')
      .select('id, clientId')
      .eq('status', 'PENDING_PAYMENT')
      .limit(200);

    if (!pending || pending.length === 0) return;

    this.logger.log(`[reconcile-cron] verificando ${pending.length} assinatura(s) PENDING_PAYMENT`);

    let activated = 0;
    for (const sub of pending) {
      try {
        const before = await this.findSubscription(sub.id).catch(() => null);
        if (!before) continue;
        const after = await this.syncWithAsaas(sub.id);
        if (after?.status === 'ACTIVE' && before.status !== 'ACTIVE') {
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

