import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeClientDto } from './dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly supabase: SupabaseService) {}

  // SUBSCRIPTION PLANS

  async createPlan(dto: CreatePlanDto) {
    const { data: plan, error } = await this.supabase
      .from('subscription_plans')
      .insert({
        name: dto.name,
        description: dto.description,
        price: dto.price,
        cutsPerMonth: dto.cutsPerMonth,
      })
      .select('*')
      .single();

    if (error) throw error;
    return plan;
  }

  async findAllPlans(activeOnly: boolean = true) {
    let queryBuilder = this.supabase
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    if (activeOnly) {
      queryBuilder = queryBuilder.eq('isActive', true);
    }

    const { data: plans, error } = await queryBuilder;

    if (error) throw error;
    return plans || [];
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
    if (dto.name !== undefined) updateData.name = dto.name;
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
      .update({ isActive: false })
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
      .select('id, cutsPerMonth')
      .eq('id', dto.planId)
      .eq('isActive', true)
      .single();

    if (!plan) {
      throw new NotFoundException('Plano não encontrado ou inativo');
    }

    // Verificar se já tem assinatura ativa
    const { data: existingSubscription } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('clientId', dto.clientId)
      .eq('status', 'ACTIVE')
      .single();

    if (existingSubscription) {
      throw new BadRequestException('Cliente já possui uma assinatura ativa');
    }

    // Criar assinatura
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const { data: subscription, error } = await this.supabase
      .from('client_subscriptions')
      .insert({
        clientId: dto.clientId,
        planId: dto.planId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cutsUsedThisMonth: 0,
        status: 'ACTIVE',
      })
      .select('*')
      .single();

    if (error) throw error;
    return subscription;
  }

  async subscribe(dto: SubscribeClientDto) {
    return this.subscribeClient(dto);
  }

  async findSubscription(id: string) {
    const { data: subscription, error } = await this.supabase
      .from('client_subscriptions')
      .select('*')
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
      .select('*')
      .order('createdAt', { ascending: false });

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: subscriptions, error } = await queryBuilder;

    if (error) throw error;
    return subscriptions || [];
  }


  async findClientSubscription(clientId: string) {
    const { data: subscription } = await this.supabase
      .from('client_subscriptions')
      .select('*')
      .eq('clientId', clientId)
      .eq('status', 'ACTIVE')
      .single();

    return subscription;
  }

  async cancelSubscription(id: string) {
    const { data: subscription, error: findError } = await this.supabase
      .from('client_subscriptions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (findError || !subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ status: 'CANCELED' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async useCut(clientId: string) {
    const subscription = await this.findClientSubscription(clientId);

    if (!subscription) {
      throw new BadRequestException('Cliente não possui assinatura ativa');
    }

    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('cutsPerMonth')
      .eq('id', subscription.planId)
      .single();

    const cutsPerMonth = plan?.cutsPerMonth ?? 0;
    const cutsUsed = subscription.cutsUsedThisMonth ?? 0;

    if (cutsUsed >= cutsPerMonth) {
      throw new BadRequestException('Não há cortes disponíveis nesta assinatura');
    }

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ cutsUsedThisMonth: cutsUsed + 1 })
      .eq('id', subscription.id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }
}
