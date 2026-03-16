import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Select padrão com joins para appointments */
  private readonly APPOINTMENT_SELECT = `
    *,
    client:clients(id, name, phone, email),
    professional:professionals(id, name),
    services:appointment_services(id, service:services(id, name, price, duration))
  `;

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
      .gte('scheduledAt', today.toISOString())
      .lt('scheduledAt', tomorrow.toISOString())
      .in('status', ['SCHEDULED', 'ATTENDED']);

    // Today's revenue
    const { data: todayPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', today.toISOString())
      .lt('paidAt', tomorrow.toISOString());

    const todayRevenue = (todayPayments || []).reduce((sum, p) => sum + p.amount, 0);

    // Month revenue
    const { data: monthPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', startOfMonth.toISOString());

    const monthRevenue = (monthPayments || []).reduce((sum, p) => sum + p.amount, 0);

    // Total clients
    const { count: totalClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    // Clients with debts
    const { count: clientsWithDebts } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('hasDebts', true);

    // Total debts
    const { data: debts } = await this.supabase
      .from('debts')
      .select('remainingBalance')
      .eq('isSettled', false);

    const totalDebts = (debts || []).reduce((sum, d) => sum + d.remainingBalance, 0);

    // Pending appointments
    const { count: pendingAppointments } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('scheduledAt', today.toISOString())
      .lt('scheduledAt', tomorrow.toISOString())
      .eq('status', 'SCHEDULED');

    // Active professionals
    const { count: totalProfessionals } = await this.supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('isActive', true);

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
      .select(this.APPOINTMENT_SELECT)
      .gte('scheduledAt', today.toISOString())
      .lt('scheduledAt', tomorrow.toISOString())
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }

  async getUpcomingAppointments(limit: number = 10) {
    const now = new Date();

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .gte('scheduledAt', now.toISOString())
      .eq('status', 'SCHEDULED')
      .order('scheduledAt', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return appointments || [];
  }

  async getRecentActivity(limit: number = 10) {
    const { data: payments } = await this.supabase
      .from('payments')
      .select('id, amount, method, createdAt, client:clients(name)')
      .order('createdAt', { ascending: false })
      .limit(5);

    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('id, status, updatedAt, client:clients(name)')
      .in('status', ['ATTENDED', 'CANCELED', 'NO_SHOW'])
      .order('updatedAt', { ascending: false })
      .limit(5);

    const statusLabels: Record<string, string> = {
      ATTENDED: 'atendido',
      CANCELED: 'cancelado',
      NO_SHOW: 'não compareceu',
    };

    const activities = [
      ...(payments || []).map((p: any) => ({
        type: 'payment',
        id: p.id,
        description: `Pagamento recebido - ${p.client?.name || 'Cliente'}`,
        amount: p.amount,
        method: p.method,
        date: p.createdAt,
      })),
      ...(appointments || []).map((a: any) => ({
        type: 'appointment',
        id: a.id,
        description: `${a.client?.name || 'Cliente'} - ${statusLabels[a.status] || a.status}`,
        status: a.status,
        date: a.updatedAt,
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
      .eq('isActive', true);

    const { count: openOrders } = await this.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    const { count: totalClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    // Top 5 clientes por gasto (agendamentos atendidos)
    const { data: allAttended } = await this.supabase
      .from('appointments')
      .select('clientId, totalPrice, client:clients(id, name, phone)')
      .eq('status', 'ATTENDED');

    const clientSpending: Record<string, { name: string; phone: string; total: number; count: number }> = {};
    for (const a of allAttended as any[] || []) {
      if (!clientSpending[a.clientId]) {
        clientSpending[a.clientId] = {
          name: a.client?.name || '',
          phone: a.client?.phone || '',
          total: 0,
          count: 0,
        };
      }
      clientSpending[a.clientId].total += a.totalPrice;
      clientSpending[a.clientId].count++;
    }
    const topClients = Object.entries(clientSpending)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Produtos com estoque baixo (quantidade <= minStock)
    const { data: products } = await this.supabase
      .from('products')
      .select('id, name, stock, minStock')
      .eq('isActive', true);

    const lowStockProducts = (products || [])
      .filter((p: any) => p.minStock != null && p.stock <= p.minStock)
      .map((p: any) => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.minStock }))
      .slice(0, 5);

    // Clientes com dividas em aberto
    const { data: debts } = await this.supabase
      .from('debts')
      .select('clientId, remainingBalance, client:clients(name, phone)')
      .eq('isSettled', false)
      .gt('remainingBalance', 0)
      .order('remainingBalance', { ascending: false })
      .limit(5);

    const unpaidClients = (debts || []).map((d: any) => ({
      name: d.client?.name || '',
      phone: d.client?.phone || '',
      debt: d.remainingBalance,
    }));

    return {
      activeProfessionals: activeProfessionals || 0,
      openOrders: openOrders || 0,
      totalClients: totalClients || 0,
      topClients,
      lowStockProducts,
      unpaidClients,
    };
  }

  async getRevenueByMethod(start?: Date, end?: Date) {
    let queryBuilder = this.supabase
      .from('payments')
      .select('amount, method');

    if (start) {
      queryBuilder = queryBuilder.gte('paidAt', start.toISOString());
    }
    if (end) {
      queryBuilder = queryBuilder.lte('paidAt', end.toISOString());
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
      .select('professionalId, totalPrice, status, professional:professionals(name)');

    if (start) {
      queryBuilder = queryBuilder.gte('scheduledAt', start.toISOString());
    }
    if (end) {
      queryBuilder = queryBuilder.lte('scheduledAt', end.toISOString());
    }

    queryBuilder = queryBuilder.eq('status', 'ATTENDED');

    const { data: appointments, error } = await queryBuilder;
    if (error) throw error;

    const byProfessional: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const a of appointments as any[] || []) {
      if (!byProfessional[a.professionalId]) {
        byProfessional[a.professionalId] = { name: a.professional?.name || '', count: 0, revenue: 0 };
      }
      byProfessional[a.professionalId].count++;
      byProfessional[a.professionalId].revenue += a.totalPrice;
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
      .select('amount, paidAt')
      .gte('paidAt', startDate.toISOString())
      .order('paidAt', { ascending: true });

    if (error) throw error;

    const byDay: Record<string, number> = {};
    for (const p of payments || []) {
      const day = new Date(p.paidAt).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + p.amount;
    }

    return Object.entries(byDay).map(([date, total]) => ({ date, total }));
  }

  async getServicesPopularity(limit: number = 10) {
    const { data: items, error } = await this.supabase
      .from('appointment_services')
      .select('serviceId');

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const item of items || []) {
      counts[item.serviceId] = (counts[item.serviceId] || 0) + 1;
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
      .gte('paidAt', startOfMonth.toISOString());

    const monthlyRevenue = (monthPayments || []).reduce((sum, p) => sum + p.amount, 0);

    const { data: yearPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', startOfYear.toISOString());

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
