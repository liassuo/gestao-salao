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
        cuts_per_month: dto.cutsPerMonth,
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
      queryBuilder = queryBuilder.eq('is_active', true);
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
    if (dto.cutsPerMonth !== undefined) updateData.cuts_per_month = dto.cutsPerMonth;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

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
      .update({ is_active: false })
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
      .select('id, cuts_per_month')
      .eq('id', dto.planId)
      .eq('is_active', true)
      .single();

    if (!plan) {
      throw new NotFoundException('Plano não encontrado ou inativo');
    }

    // Verificar se já tem assinatura ativa
    const { data: existingSubscription } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .eq('client_id', dto.clientId)
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
        client_id: dto.clientId,
        plan_id: dto.planId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        cuts_remaining: plan.cuts_per_month,
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
    return { remainingCuts: subscription.cuts_remaining ?? 0 };
  }

  async findAllSubscriptions(status?: string) {
    let queryBuilder = this.supabase
      .from('client_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

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
      .eq('client_id', clientId)
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

    if (subscription.cuts_remaining <= 0) {
      throw new BadRequestException('Não há cortes disponíveis nesta assinatura');
    }

    const { data: updated, error } = await this.supabase
      .from('client_subscriptions')
      .update({ cuts_remaining: subscription.cuts_remaining - 1 })
      .eq('id', subscription.id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }
}
