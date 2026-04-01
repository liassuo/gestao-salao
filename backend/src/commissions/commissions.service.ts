import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';

@Injectable()
export class CommissionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async generate(dto: GenerateCommissionDto) {
    if (dto.periodStart >= dto.periodEnd) {
      throw new BadRequestException('A data de início deve ser anterior à data de fim');
    }

    const startStr = `${dto.periodStart}T00:00:00`;
    const endStr = `${dto.periodEnd}T23:59:59`;

    // 1) Serviços avulsos (appointments sem assinatura)
    const { data: regularAppointments } = await this.supabase
      .from('appointments')
      .select('professionalId, totalPrice')
      .eq('status', 'ATTENDED')
      .neq('usedSubscriptionCut', true)
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);

    // 2) Serviços por assinatura (valor proporcional do plano por corte realizado)
    const { data: subscriptionAppointments } = await this.supabase
      .from('appointments')
      .select('professionalId, clientId, totalPrice')
      .eq('status', 'ATTENDED')
      .eq('usedSubscriptionCut', true)
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);

    // 3) Produtos (comandas pagas com itens do tipo PRODUCT)
    const { data: paidOrders } = await this.supabase
      .from('orders')
      .select('professionalId, items:order_items(unitPrice, quantity, itemType)')
      .eq('status', 'PAID')
      .gte('createdAt', startStr)
      .lte('createdAt', endStr);

    const hasData =
      (regularAppointments && regularAppointments.length > 0) ||
      (subscriptionAppointments && subscriptionAppointments.length > 0) ||
      (paidOrders && paidOrders.length > 0);

    if (!hasData) {
      throw new BadRequestException('Nenhum atendimento ou venda encontrado no período informado');
    }

    // Agrupar por profissional: { services, subscription, products }
    const grouped = new Map<string, { services: number; subscription: number; products: number }>();

    const getEntry = (profId: string) => {
      if (!grouped.has(profId)) {
        grouped.set(profId, { services: 0, subscription: 0, products: 0 });
      }
      return grouped.get(profId)!;
    };

    for (const appt of regularAppointments || []) {
      getEntry(appt.professionalId).services += appt.totalPrice;
    }

    // Para assinaturas: cada corte vale planPrice / cutsPerMonth (proporcional)
    // Cache dos planos por clientId para evitar queries repetidas
    const clientPlanCache = new Map<string, { price: number; cutsPerMonth: number } | null>();

    for (const appt of subscriptionAppointments || []) {
      if (!clientPlanCache.has(appt.clientId)) {
        // Busca a assinatura mais recente do cliente (qualquer status, pois pode ter expirado após o uso)
        const { data: subscription } = await this.supabase
          .from('client_subscriptions')
          .select('plan:subscription_plans(price, cutsPerMonth)')
          .eq('clientId', appt.clientId)
          .order('createdAt', { ascending: false })
          .limit(1)
          .maybeSingle();

        const plan = (subscription as any)?.plan;
        clientPlanCache.set(
          appt.clientId,
          plan && plan.cutsPerMonth > 0 ? { price: plan.price, cutsPerMonth: plan.cutsPerMonth } : null,
        );
      }

      const plan = clientPlanCache.get(appt.clientId);
      if (plan) {
        // Plano ilimitado (99): usa o preço do serviço realizado (totalPrice do appointment)
        // Plano normal: valor proporcional = planPrice / cutsPerMonth
        const valuePerCut = plan.cutsPerMonth === 99
          ? appt.totalPrice
          : Math.round(plan.price / plan.cutsPerMonth);
        getEntry(appt.professionalId).subscription += valuePerCut;
      }
    }

    for (const order of paidOrders || []) {
      if (!order.professionalId) continue;
      const productTotal = ((order as any).items || [])
        .filter((item: any) => item.itemType === 'PRODUCT')
        .reduce((sum: number, item: any) => sum + item.unitPrice * (item.quantity || 1), 0);
      if (productTotal > 0) {
        getEntry(order.professionalId).products += productTotal;
      }
    }

    const createdCommissions = [];

    for (const [professionalId, totals] of grouped) {
      const { data: professional } = await this.supabase
        .from('professionals')
        .select('id, commissionRate, branchId')
        .eq('id', professionalId)
        .single();

      if (!professional || !professional.commissionRate) continue;

      const rate = professional.commissionRate;
      const amountServices = Math.round((totals.services * rate) / 100);
      const amountSubscription = Math.round((totals.subscription * rate) / 100);
      const amountProducts = Math.round((totals.products * rate) / 100);
      const amount = amountServices + amountSubscription + amountProducts;

      if (amount <= 0) continue;

      const d = new Date();
      const comNow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const { data: commission, error } = await this.supabase
        .from('commissions')
        .insert({
          id: randomUUID(),
          amount,
          amountServices,
          amountSubscription,
          amountProducts,
          periodStart: startStr,
          periodEnd: endStr,
          status: 'PENDING',
          professionalId: professionalId,
          branchId: professional.branchId,
          createdAt: comNow,
          updatedAt: comNow,
        })
        .select('*, professional:professionals(id, name, commissionRate)')
        .single();

      if (!error) createdCommissions.push(commission);
    }

    if (createdCommissions.length === 0) {
      throw new BadRequestException(
        'Nenhuma comissão gerada. Verifique se os profissionais possuem taxa de comissão configurada',
      );
    }

    return createdCommissions;
  }

  async findAll(query: QueryCommissionDto) {
    let queryBuilder = this.supabase
      .from('commissions')
      .select('*, professional:professionals(id, name, commissionRate)');

    if (query.professionalId) {
      queryBuilder = queryBuilder.eq('professionalId', query.professionalId);
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('periodStart', `${query.startDate}T00:00:00`);
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('periodStart', `${query.endDate}T23:59:59`);
    }

    const { data: commissions, error } = await queryBuilder.order('createdAt', { ascending: false });

    if (error) throw error;
    return commissions || [];
  }

  async findOne(id: string) {
    const { data: commission, error } = await this.supabase
      .from('commissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    return commission;
  }

  async markAsPaid(id: string) {
    const { data: commission, error } = await this.supabase
      .from('commissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    if (commission.status === 'PAID') {
      throw new BadRequestException('Esta comissão já foi paga');
    }

    const d = new Date();
    const paidNow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const { data: updated, error: updateError } = await this.supabase
      .from('commissions')
      .update({ status: 'PAID', paidAt: paidNow })
      .eq('id', id)
      .select('*, professional:professionals(id, name, commissionRate)')
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async remove(id: string) {
    const { data: commission, error: findError } = await this.supabase
      .from('commissions')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    const { error } = await this.supabase.from('commissions').delete().eq('id', id);

    if (error) throw error;
  }
}
