import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ReportFilters {
  startDate: string; // "YYYY-MM-DDT00:00:00"
  endDate: string;   // "YYYY-MM-DDT23:59:59"
  professionalId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getSalesReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const { data: payments } = await this.supabase
      .from('payments')
      .select('*')
      .gte('paidAt', startDate)
      .lte('paidAt', endDate)
      .order('paidAt', { ascending: false });

    const totalRevenue = (payments || []).reduce((sum, p) => sum + p.amount, 0);
    const averageTicket = (payments || []).length > 0 ? totalRevenue / (payments || []).length : 0;

    const byMethod = {
      CASH: { total: 0, count: 0 },
      PIX: { total: 0, count: 0 },
      CARD: { total: 0, count: 0 },
    };

    for (const payment of payments || []) {
      const method = payment.method as keyof typeof byMethod;
      if (byMethod[method]) {
        byMethod[method].total += payment.amount;
        byMethod[method].count += 1;
      }
    }

    return {
      period: { startDate, endDate },
      summary: {
        totalRevenue,
        totalTransactions: (payments || []).length,
        averageTicket: Math.round(averageTicket),
      },
      byMethod: Object.entries(byMethod).map(([method, data]) => ({
        method,
        total: data.total,
        count: data.count,
        percentage: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0,
      })),
      transactions: payments || [],
    };
  }

  async getProfessionalReport(filters: ReportFilters) {
    const { startDate, endDate, professionalId } = filters;

    let query = this.supabase
      .from('professionals')
      .select('id, name, commissionRate')
      .eq('isActive', true);

    if (professionalId) {
      query = query.eq('id', professionalId);
    }

    const { data: professionals } = await query;

    const result = [];
    for (const professional of professionals || []) {
      const { data: appointments, count } = await this.supabase
        .from('appointments')
        .select('totalPrice, status', { count: 'exact' })
        .eq('professionalId', professional.id)
        .gte('scheduledAt', startDate)
        .lte('scheduledAt', endDate);

      const attended = (appointments || []).filter((a) => a.status === 'ATTENDED');
      const totalRevenue = attended.reduce((sum, a) => sum + a.totalPrice, 0);
      const commissionRate = professional.commissionRate || 0;
      const commission = Math.round(totalRevenue * (commissionRate / 100));

      result.push({
        id: professional.id,
        name: professional.name,
        commissionRate,
        stats: {
          total: count || 0,
          attended: attended.length,
          canceled: (appointments || []).filter((a) => a.status === 'CANCELED').length,
          noShow: (appointments || []).filter((a) => a.status === 'NO_SHOW').length,
          scheduled: (appointments || []).filter((a) => a.status === 'SCHEDULED').length,
          attendanceRate: (count || 0) > 0 ? Math.round((attended.length / (count || 1)) * 100) : 0,
        },
        financial: {
          totalRevenue,
          commission,
          averageTicket: attended.length > 0 ? Math.round(totalRevenue / attended.length) : 0,
        },
      });
    }

    return result;
  }

  async getServicesReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    // 1. Buscar todos os serviços ativos
    const { data: services } = await this.supabase
      .from('services')
      .select('id, name, price, duration')
      .eq('isActive', true);

    if (!services || services.length === 0) return [];

    // 2. Buscar agendamentos ATTENDED no período com seus serviços
    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('id, totalPrice, scheduledAt, services:appointment_services(serviceId)')
      .eq('status', 'ATTENDED')
      .gte('scheduledAt', startDate)
      .lte('scheduledAt', endDate);

    // 3. Buscar promoções que estiveram ativas no período
    const { data: promotions } = await this.supabase
      .from('promotions')
      .select('discountPercent, startDate, endDate, promotion_services(serviceId)')
      .eq('isActive', true);

    // Helper: verificar se um serviço tinha promoção na data do agendamento
    const getDiscountForServiceAtDate = (serviceId: string, date: string): number | null => {
      if (!promotions) return null;
      for (const promo of promotions) {
        if (promo.startDate && date < promo.startDate) continue;
        if (promo.endDate && date > promo.endDate) continue;
        const match = (promo.promotion_services as any[])?.find(
          (ps) => ps.serviceId === serviceId,
        );
        if (match) return promo.discountPercent;
      }
      return null;
    };

    // 4. Contar e calcular receita por serviço
    const serviceMap = new Map<string, { count: number; revenue: number; hadPromotion: boolean }>();
    for (const s of services) {
      serviceMap.set(s.id, { count: 0, revenue: 0, hadPromotion: false });
    }

    for (const appt of appointments || []) {
      const apptServices = (appt.services as any[]) || [];
      for (const as of apptServices) {
        const sid = as.serviceId;
        const entry = serviceMap.get(sid);
        const service = services.find((s) => s.id === sid);
        if (!entry || !service) continue;

        entry.count += 1;
        const discount = getDiscountForServiceAtDate(sid, appt.scheduledAt);
        if (discount !== null) {
          entry.revenue += Math.round(service.price * (100 - discount) / 100);
          entry.hadPromotion = true;
        } else {
          entry.revenue += service.price;
        }
      }
    }

    // 5. Calcular totais e percentuais
    const totalRevenue = Array.from(serviceMap.values()).reduce((sum, s) => sum + s.revenue, 0);

    return services
      .map((s) => {
        const data = serviceMap.get(s.id) || { count: 0, revenue: 0, hadPromotion: false };
        return {
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          count: data.count,
          revenue: data.revenue,
          percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
          hadPromotion: data.hadPromotion,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  async getClientsReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const { count: newClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .gte('createdAt', startDate)
      .lte('createdAt', endDate);

    const { count: activeClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('isActive', true);

    const { data: clientsWithDebts } = await this.supabase
      .from('clients')
      .select('id, name, phone')
      .eq('hasDebts', true);

    const { data: debts } = await this.supabase
      .from('debts')
      .select('remainingBalance')
      .eq('isSettled', false);

    const totalDebt = (debts || []).reduce((sum, d) => sum + d.remainingBalance, 0);

    return {
      summary: {
        newClients: newClients || 0,
        activeClients: activeClients || 0,
        clientsWithDebts: (clientsWithDebts || []).length,
        totalDebt,
      },
      topClients: [],
      debtors: (clientsWithDebts || []).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalDebt: 0,
        debtsCount: 0,
      })),
    };
  }

  async getDebtsReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const { data: debtsCreated } = await this.supabase
      .from('debts')
      .select('*')
      .gte('createdAt', startDate)
      .lte('createdAt', endDate);

    const { data: currentDebts } = await this.supabase
      .from('debts')
      .select('*')
      .eq('isSettled', false)
      .order('createdAt', { ascending: true });

    const totalCreated = (debtsCreated || []).reduce((sum, d) => sum + d.amount, 0);
    const totalOutstanding = (currentDebts || []).reduce((sum, d) => sum + d.remainingBalance, 0);

    return {
      summary: {
        debtsCreatedCount: (debtsCreated || []).length,
        totalCreated,
        debtsPaidCount: 0,
        totalPaid: 0,
        currentDebtsCount: (currentDebts || []).length,
        totalOutstanding,
      },
      created: debtsCreated || [],
      outstanding: currentDebts || [],
    };
  }

  async getCashRegisterReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const { data: registers } = await this.supabase
      .from('cash_registers')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const summary = (registers || []).reduce(
      (acc, r) => ({
        totalCash: acc.totalCash + (r.totalCash || 0),
        totalPix: acc.totalPix + (r.totalPix || 0),
        totalCard: acc.totalCard + (r.totalCard || 0),
        totalRevenue: acc.totalRevenue + (r.totalRevenue || 0),
        totalDiscrepancy: acc.totalDiscrepancy + (r.discrepancy || 0),
      }),
      { totalCash: 0, totalPix: 0, totalCard: 0, totalRevenue: 0, totalDiscrepancy: 0 },
    );

    return {
      summary: {
        ...summary,
        daysCount: (registers || []).length,
        averageDaily: (registers || []).length > 0 ? Math.round(summary.totalRevenue / (registers || []).length) : 0,
      },
      registers: registers || [],
    };
  }
}
