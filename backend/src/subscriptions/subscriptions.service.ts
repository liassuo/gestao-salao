import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  ) {}

  // SUBSCRIPTION PLANS

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
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;
    return plan;
  }

  async findAllPlans(activeOnly: boolean = true) {
    let queryBuilder = this.supabase
      .from('subscription_plans')
      .select('*, subscriptions:client_subscriptions(id)')
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
      .select('*')
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
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const { data: updated, error } = await this.supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
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
    const { data: insertedSub, error } = await this.supabase
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
      })
      .select('*')
      .single();

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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
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
      resolved = minimal as typeof subscription;
    }

    // Criar assinatura recorrente no Asaas (se configurado)
    if (this.asaasService.configured && resolved) {
      try {
        // Buscar cliente com asaasCustomerId
        const { data: clientData } = await this.supabase
          .from('clients')
          .select('id, name, email, phone, asaasCustomerId')
          .eq('id', dto.clientId)
          .single();

        let asaasCustomerId = clientData?.asaasCustomerId;
        if (!asaasCustomerId && clientData) {
          const asaasCustomer = await this.asaasService.createCustomer({
            name: clientData.name,
            email: clientData.email || undefined,
            mobilePhone: clientData.phone || undefined,
            externalReference: clientData.id,
          });
          asaasCustomerId = asaasCustomer.id;
          await this.supabase
            .from('clients')
            .update({ asaasCustomerId })
            .eq('id', clientData.id);
        }

        if (asaasCustomerId) {
          const parsed = parseAsaasBillingType(dto.billingType);
          const billingType =
            parsed === AsaasBillingType.CREDIT_CARD
              ? AsaasBillingType.CREDIT_CARD
              : AsaasBillingType.PIX;
          const asaasSub = await this.asaasService.createSubscription({
            customer: asaasCustomerId,
            billingType,
            value: this.asaasService.centavosToReais(plan.price ?? 0),
            nextDueDate: startDate.toISOString().split('T')[0],
            cycle: AsaasSubscriptionCycle.MONTHLY,
            description: `Plano ${plan.name ?? 'Assinatura'}`,
            externalReference: resolved.id,
          });

          await this.supabase
            .from('client_subscriptions')
            .update({ asaasSubscriptionId: asaasSub.id })
            .eq('id', resolved.id);

          this.logger.log(`Assinatura Asaas criada: ${asaasSub.id}`);
        }
      } catch (syncError) {
        this.logger.warn(`Falha ao criar assinatura no Asaas: ${syncError}`);
      }
    }

    return resolved;
  }

  async subscribe(dto: SubscribeClientDto) {
    return this.subscribeClient(dto);
  }

  async findSubscription(id: string) {
    const { data: subscription, error } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
      .eq('id', id)
      .single();

    if (error || !subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    return subscription;
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
      .eq('clientId', clientId)
      .neq('status', 'CANCELED')
      .order('createdAt', { ascending: false })
      .limit(1);

    const subscription = results?.[0] ?? null;

    // Auto-suspender se endDate venceu e ainda está ACTIVE
    if (subscription && subscription.status === 'ACTIVE') {
      const endDate = new Date(subscription.endDate);
      if (new Date() > endDate) {
        const now = new Date().toISOString();
        const { data: suspended } = await this.supabase
          .from('client_subscriptions')
          .update({ status: 'SUSPENDED', updatedAt: now })
          .eq('id', subscription.id)
          .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
          .single();
        this.logger.log(`Assinatura ${subscription.id} suspensa automaticamente (endDate ${subscription.endDate} vencido)`);
        return suspended ?? subscription;
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
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
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
      .single();

    if (error) throw error;
    return updated;
  }

  /**
   * Força uma cobrança manual no Asaas para uma assinatura específica.
   * Cria um registro de pagamento pendente vinculado à assinatura.
   */
  // CLIENT-FACING METHODS (JWT auth)

  async getMySubscription(clientId: string) {
    return this.findClientSubscription(clientId);
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
    if (this.asaasService.configured && freshSub?.asaasSubscriptionId) {
      if (effectiveBilling === AsaasBillingType.CREDIT_CARD && body.creditCard) {
        try {
          await this.asaasService.updateSubscription(freshSub.asaasSubscriptionId, {
            creditCard: body.creditCard,
            creditCardHolderInfo: body.creditCardHolderInfo,
            remoteIp: body.remoteIp,
          });
          this.logger.log(`Dados de cartão enviados para assinatura ${freshSub.asaasSubscriptionId}`);
        } catch (e) {
          this.logger.warn(`Falha ao enviar dados de cartão para assinatura: ${e}`);
        }
      }
      try {
        const charges = await this.asaasService.getSubscriptionPayments(freshSub.asaasSubscriptionId);
        const pending =
          charges.find((c: any) => c.status === 'PENDING') ??
          charges.find((c: any) => c.status === 'AWAITING_RISK_ANALYSIS') ??
          charges[0];
        if (pending) {
          const now = new Date().toISOString();
          const localMethod = asaasBillingToLocalPaymentMethod(effectiveBilling);
          invoiceUrl = pending.invoiceUrl || null;

          if (effectiveBilling === AsaasBillingType.PIX) {
            pixData = await this.asaasService.getPixQrCode(pending.id);
          }

          await this.supabase.from('payments').insert({
            id: randomUUID(),
            clientId,
            subscriptionId: freshSub.id,
            amount: freshSub.plan?.price ?? 0,
            method: localMethod,
            registeredBy: clientId,
            notes: `Cobrança inicial assinatura Asaas #${pending.id}`,
            asaasPaymentId: pending.id,
            asaasStatus: pending.status,
            paidAt: null,
            invoiceUrl,
            bankSlipUrl: pending.bankSlipUrl || null,
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (e) {
        this.logger.warn(`Falha ao sincronizar cobrança inicial da assinatura: ${e}`);
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
      .select('*, client:clients(id, name, phone, asaasCustomerId, email), plan:subscription_plans(id, name, price, cutsPerMonth)')
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
        let asaasCustomerId = subscription.client?.asaasCustomerId;
        if (!asaasCustomerId) {
          const { data: clientData } = await this.supabase
            .from('clients')
            .select('asaasCustomerId, name, email, phone')
            .eq('id', clientId)
            .single();

          if (!clientData?.asaasCustomerId && clientData) {
            const asaasCustomer = await this.asaasService.createCustomer({
              name: clientData.name,
              email: clientData.email || undefined,
              mobilePhone: clientData.phone || undefined,
              externalReference: clientId,
            });
            asaasCustomerId = asaasCustomer.id;
            await this.supabase.from('clients').update({ asaasCustomerId }).eq('id', clientId);
          } else {
            asaasCustomerId = clientData?.asaasCustomerId;
          }
        }

        if (asaasCustomerId) {
          const today = now.toISOString().split('T')[0];
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
          });

          const localMethod = asaasBillingToLocalPaymentMethod(billingType);
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
            invoiceUrl: charge.invoiceUrl || null,
            bankSlipUrl: charge.bankSlipUrl || null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });

          if (billingType === AsaasBillingType.PIX) {
            pixData = await this.asaasService.getPixQrCode(charge.id);
          } else {
            invoiceUrl = charge.invoiceUrl || null;
          }
        }
      } catch (e) {
        this.logger.warn(`Falha ao gerar cobrança de reativação: ${e}`);
      }
    }

    // Re-fetch atualizado
    const { data: updated } = await this.supabase
      .from('client_subscriptions')
      .select('*, client:clients(id, name, phone), plan:subscription_plans(id, name, price, cutsPerMonth)')
      .eq('id', subscription.id)
      .single();

    return { subscription: updated ?? subscription, pixData, invoiceUrl };
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

    // 1. Buscar asaasCustomerId do cliente (se não tiver, criar)
    const { data: clientData } = await this.supabase
      .from('clients')
      .select('asaasCustomerId, email, phone, name')
      .eq('id', subscription.clientId)
      .single();

    let asaasCustomerId = clientData?.asaasCustomerId;
    if (!asaasCustomerId && clientData) {
      const asaasCustomer = await this.asaasService.createCustomer({
        name: clientData.name,
        email: clientData.email || undefined,
        mobilePhone: clientData.phone || undefined,
        externalReference: subscription.clientId,
      });
      asaasCustomerId = asaasCustomer.id;
      await this.supabase
        .from('clients')
        .update({ asaasCustomerId })
        .eq('id', subscription.clientId);
    }

    if (!asaasCustomerId) {
      throw new BadRequestException('Não foi possível obter o ID do cliente no Asaas');
    }

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
}

