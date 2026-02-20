import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Today's appointments
    const { count: todayAppointments } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .in('status', ['SCHEDULED', 'ATTENDED']);

    // Today's revenue
    const { data: todayPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paid_at', today.toISOString())
      .lt('paid_at', tomorrow.toISOString());

    const todayRevenue = (todayPayments || []).reduce((sum, p) => sum + p.amount, 0);

    // Month revenue
    const { data: monthPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paid_at', startOfMonth.toISOString());

    const monthRevenue = (monthPayments || []).reduce((sum, p) => sum + p.amount, 0);

    // Total clients
    const { count: totalClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    // Clients with debts
    const { count: clientsWithDebts } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('has_debts', true);

    // Total debts
    const { data: debts } = await this.supabase
      .from('debts')
      .select('remaining_balance')
      .eq('is_settled', false);

    const totalDebts = (debts || []).reduce((sum, d) => sum + d.remaining_balance, 0);

    // Pending appointments
    const { count: pendingAppointments } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .eq('status', 'SCHEDULED');

    // Active professionals
    const { count: totalProfessionals } = await this.supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    return {
      todayAppointments: todayAppointments || 0,
      pendingAppointments: pendingAppointments || 0,
      todayRevenue,
      monthRevenue,
      revenueChange: 0,
      totalClients: totalClients || 0,
      activeClients: 0,
      clientsWithDebts: clientsWithDebts || 0,
      totalDebts,
      totalProfessionals: totalProfessionals || 0,
    };
  }

  async getTodayAppointments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('*')
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }

  async getUpcomingAppointments(limit: number = 10) {
    const now = new Date();

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('*')
      .gte('scheduled_at', now.toISOString())
      .eq('status', 'SCHEDULED')
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return appointments || [];
  }

  async getRecentActivity(limit: number = 10) {
    const { data: payments } = await this.supabase
      .from('payments')
      .select('id, amount, method, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('id, status, updated_at')
      .in('status', ['ATTENDED', 'CANCELED', 'NO_SHOW'])
      .order('updated_at', { ascending: false })
      .limit(5);

    const activities = [
      ...(payments || []).map((p) => ({
        type: 'payment',
        id: p.id,
        description: 'Pagamento recebido',
        amount: p.amount,
        method: p.method,
        date: p.created_at,
      })),
      ...(appointments || []).map((a) => ({
        type: 'appointment',
        id: a.id,
        description: `Agendamento ${a.status}`,
        status: a.status,
        date: a.updated_at,
      })),
    ];

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async getOperationalData() {
    const { count: activeProfessionals } = await this.supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: openOrders } = await this.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    const { count: totalClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    return {
      activeProfessionals: activeProfessionals || 0,
      openOrders: openOrders || 0,
      totalClients: totalClients || 0,
      topClients: [],
      lowStockProducts: [],
      unpaidClients: [],
    };
  }

  async getRevenueByMethod(start?: Date, end?: Date) {
    let queryBuilder = this.supabase
      .from('payments')
      .select('amount, method');

    if (start) {
      queryBuilder = queryBuilder.gte('paid_at', start.toISOString());
    }
    if (end) {
      queryBuilder = queryBuilder.lte('paid_at', end.toISOString());
    }

    const { data: payments, error } = await queryBuilder;
    if (error) throw error;

    const byMethod: Record<string, number> = {};
    for (const p of payments || []) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }

    return Object.entries(byMethod).map(([method, total]) => ({ method, total }));
  }

  async getProfessionalPerformance(start?: Date, end?: Date) {
    let queryBuilder = this.supabase
      .from('appointments')
      .select('professional_id, total_price, status');

    if (start) {
      queryBuilder = queryBuilder.gte('scheduled_at', start.toISOString());
    }
    if (end) {
      queryBuilder = queryBuilder.lte('scheduled_at', end.toISOString());
    }

    queryBuilder = queryBuilder.eq('status', 'ATTENDED');

    const { data: appointments, error } = await queryBuilder;
    if (error) throw error;

    const byProfessional: Record<string, { count: number; revenue: number }> = {};
    for (const a of appointments || []) {
      if (!byProfessional[a.professional_id]) {
        byProfessional[a.professional_id] = { count: 0, revenue: 0 };
      }
      byProfessional[a.professional_id].count++;
      byProfessional[a.professional_id].revenue += a.total_price;
    }

    return Object.entries(byProfessional).map(([professionalId, data]) => ({
      professionalId,
      ...data,
    }));
  }

  async getDailyRevenue(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('amount, paid_at')
      .gte('paid_at', startDate.toISOString())
      .order('paid_at', { ascending: true });

    if (error) throw error;

    const byDay: Record<string, number> = {};
    for (const p of payments || []) {
      const day = new Date(p.paid_at).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + p.amount;
    }

    return Object.entries(byDay).map(([date, total]) => ({ date, total }));
  }

  async getServicesPopularity(limit: number = 10) {
    const { data: items, error } = await this.supabase
      .from('appointment_services')
      .select('service_id');

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const item of items || []) {
      counts[item.service_id] = (counts[item.service_id] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([serviceId, count]) => ({ serviceId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getStrategicData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const { count: activePlans } = await this.supabase
      .from('client_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    const { data: monthPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paid_at', startOfMonth.toISOString());

    const monthlyRevenue = (monthPayments || []).reduce((sum, p) => sum + p.amount, 0);

    const { data: yearPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paid_at', startOfYear.toISOString());

    const yearlyRevenue = (yearPayments || []).reduce((sum, p) => sum + p.amount, 0);

    return {
      plans: {
        activePlans: activePlans || 0,
        soldThisMonth: 0,
        canceledThisMonth: 0,
      },
      revenue: {
        monthlyRevenue,
        yearlyRevenue,
      },
      monthlyRevenueHistory: [],
      professionalOccupancy: [],
    };
  }
}
