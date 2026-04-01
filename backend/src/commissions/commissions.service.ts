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

    // 2) Serviços por assinatura (sistema de pote com fichas)
    const { data: subscriptionAppointments } = await this.supabase
      .from('appointments')
      .select('professionalId, clientId, services:appointment_services(service:services(fichas, duration))')
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

    // Sistema de pote com fichas para assinaturas:
    // 1. Somar todas as fichas geradas por cada profissional
    // 2. Somar o valor total das assinaturas ativas no período (o "pote")
    // 3. Distribuir o pote proporcionalmente pelas fichas de cada profissional

    // Calcular fichas por profissional (fichas do serviço, ou duration como fallback)
    const fichasByProfessional = new Map<string, number>();
    let totalFichas = 0;

    for (const appt of subscriptionAppointments || []) {
      const apptFichas = ((appt as any).services || []).reduce(
        (sum: number, as_: any) => sum + (as_.service?.fichas || as_.service?.duration || 0),
        0,
      );
      const existing = fichasByProfessional.get(appt.professionalId) || 0;
      fichasByProfessional.set(appt.professionalId, existing + apptFichas);
      totalFichas += apptFichas;
    }

    // Calcular o pote: valor total das assinaturas que se sobrepõem ao período
    if (totalFichas > 0) {
      const { data: activeSubscriptions } = await this.supabase
        .from('client_subscriptions')
        .select('plan:subscription_plans(price)')
        .in('status', ['ACTIVE', 'SUSPENDED'])
        .lte('startDate', endStr)
        .gte('endDate', startStr);

      const totalSubscriptionValue = (activeSubscriptions || []).reduce(
        (sum: number, sub: any) => sum + (sub.plan?.price || 0),
        0,
      );

      // Distribuir o pote proporcionalmente pelas fichas
      for (const [profId, profFichas] of fichasByProfessional) {
        const subscriptionShare = Math.round((profFichas / totalFichas) * totalSubscriptionValue);
        getEntry(profId).subscription += subscriptionShare;
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

  async getPoteReport(periodStart: string, periodEnd: string) {
    const startStr = `${periodStart}T00:00:00`;
    const endStr = `${periodEnd}T23:59:59`;

    // Buscar atendimentos de assinatura no período
    const { data: subscriptionAppointments } = await this.supabase
      .from('appointments')
      .select('professionalId, services:appointment_services(service:services(id, name, fichas, duration))')
      .eq('status', 'ATTENDED')
      .eq('usedSubscriptionCut', true)
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);

    // Buscar assinaturas que se sobrepõem ao período
    const { data: activeSubscriptions } = await this.supabase
      .from('client_subscriptions')
      .select('plan:subscription_plans(name, price)')
      .in('status', ['ACTIVE', 'SUSPENDED'])
      .lte('startDate', endStr)
      .gte('endDate', startStr);

    const totalSubscriptionValue = (activeSubscriptions || []).reduce(
      (sum: number, sub: any) => sum + (sub.plan?.price || 0),
      0,
    );

    // Agrupar fichas por profissional e por serviço
    const profMap = new Map<string, { fichas: number; services: Map<string, { name: string; count: number; fichas: number }> }>();
    let totalFichas = 0;
    let totalServices = 0;

    for (const appt of subscriptionAppointments || []) {
      if (!profMap.has(appt.professionalId)) {
        profMap.set(appt.professionalId, { fichas: 0, services: new Map() });
      }
      const prof = profMap.get(appt.professionalId)!;

      for (const as_ of (appt as any).services || []) {
        const svc = as_.service;
        if (!svc) continue;
        const svcFichas = svc.fichas || svc.duration || 0;
        prof.fichas += svcFichas;
        totalFichas += svcFichas;
        totalServices++;

        if (!prof.services.has(svc.id)) {
          prof.services.set(svc.id, { name: svc.name, count: 0, fichas: 0 });
        }
        const svcEntry = prof.services.get(svc.id)!;
        svcEntry.count++;
        svcEntry.fichas += svcFichas;
      }
    }

    // Buscar nomes dos profissionais
    const profIds = Array.from(profMap.keys());
    const professionals: { id: string; name: string; commissionRate: number }[] = [];
    for (const profId of profIds) {
      const { data: prof } = await this.supabase
        .from('professionals')
        .select('id, name, commissionRate')
        .eq('id', profId)
        .single();
      if (prof) professionals.push(prof);
    }

    // Montar resultado por profissional
    const byProfessional = professionals.map((prof) => {
      const entry = profMap.get(prof.id)!;
      const percentage = totalFichas > 0 ? entry.fichas / totalFichas : 0;
      const shareOfPot = Math.round(percentage * totalSubscriptionValue);
      const commission = Math.round((shareOfPot * (prof.commissionRate || 0)) / 100);

      return {
        professionalId: prof.id,
        professionalName: prof.name,
        commissionRate: prof.commissionRate,
        fichas: entry.fichas,
        percentage: Math.round(percentage * 10000) / 100,
        shareOfPot,
        commission,
        services: Array.from(entry.services.values()),
      };
    }).sort((a, b) => b.fichas - a.fichas);

    return {
      periodStart,
      periodEnd,
      totalServices,
      totalFichas,
      totalSubscriptionValue,
      activeSubscriptions: activeSubscriptions?.length || 0,
      byProfessional,
    };
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
