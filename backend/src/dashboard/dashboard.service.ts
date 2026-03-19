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

  private getLocalDateStr(date: Date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async getStats() {
    const todayStr = this.getLocalDateStr();
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;

    // Today's appointments
    const { count: todayAppointments } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('scheduledAt', todayStart)
      .lte('scheduledAt', todayEnd)
      .in('status', ['SCHEDULED', 'ATTENDED']);

    // Today's revenue
    const { data: todayPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', todayStart)
      .lte('paidAt', todayEnd);

    const todayRevenue = (todayPayments || []).reduce((sum, p) => sum + p.amount, 0);

    // Month revenue
    const { data: monthPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', monthStart);

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
      .gte('scheduledAt', todayStart)
      .lte('scheduledAt', todayEnd)
      .eq('status', 'SCHEDULED');

    // Active professionals
    const { count: totalProfessionals } = await this.supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('isActive', true);

    // Active clients
    const { count: activeClients } = await this.supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('isActive', true);

    return {
      todayAppointments: todayAppointments || 0,
      pendingAppointments: pendingAppointments || 0,
      todayRevenue,
      monthRevenue,
      revenueChange: 0,
      totalClients: totalClients || 0,
      activeClients: activeClients || 0,
      clientsWithDebts: clientsWithDebts || 0,
      totalDebts,
      totalProfessionals: totalProfessionals || 0,
    };
  }

  async getTodayAppointments() {
    const todayStr = this.getLocalDateStr();
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .gte('scheduledAt', todayStart)
      .lte('scheduledAt', todayEnd)
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }

  async getUpcomingAppointments(limit: number = 10) {
    const nowStr = this.getLocalDateStr();
    const now = new Date();
    const nowTime = `${nowStr}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .gte('scheduledAt', nowTime)
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

    // Aniversariantes do mês
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    const { data: allClients } = await this.supabase
      .from('clients')
      .select('id, name, phone, birthDate')
      .eq('isActive', true)
      .not('birthDate', 'is', null);

    const birthdayClients = (allClients || [])
      .filter((c: any) => {
        if (!c.birthDate) return false;
        const month = String(c.birthDate).substring(5, 7);
        return month === currentMonth;
      })
      .map((c: any) => {
        const day = parseInt(String(c.birthDate).substring(8, 10), 10);
        return { id: c.id, name: c.name, phone: c.phone, birthDate: c.birthDate, day };
      })
      .sort((a, b) => a.day - b.day)
      .slice(0, 10);

    // Clientes com dividas em aberto (agrupados por cliente)
    const { data: debts } = await this.supabase
      .from('debts')
      .select('clientId, remainingBalance, client:clients(id, name, phone)')
      .eq('isSettled', false)
      .gt('remainingBalance', 0);

    const clientDebtMap = new Map<string, { id: string; name: string; phone: string; unpaidAmount: number; unpaidCount: number }>();
    for (const d of debts || []) {
      const clientId = d.clientId;
      const existing = clientDebtMap.get(clientId);
      if (existing) {
        existing.unpaidAmount += d.remainingBalance || 0;
        existing.unpaidCount += 1;
      } else {
        clientDebtMap.set(clientId, {
          id: clientId,
          name: (d.client as any)?.name || '',
          phone: (d.client as any)?.phone || '',
          unpaidAmount: d.remainingBalance || 0,
          unpaidCount: 1,
        });
      }
    }

    const unpaidClients = Array.from(clientDebtMap.values())
      .sort((a, b) => b.unpaidAmount - a.unpaidAmount)
      .slice(0, 5);

    return {
      activeProfessionals: activeProfessionals || 0,
      openOrders: openOrders || 0,
      totalClients: totalClients || 0,
      topClients,
      birthdayClients,
      unpaidClients,
    };
  }

  async getRevenueByMethod(start?: Date, end?: Date) {
    let queryBuilder = this.supabase
      .from('payments')
      .select('amount, method');

    if (start) {
      queryBuilder = queryBuilder.gte('paidAt', `${this.getLocalDateStr(start)}T00:00:00`);
    }
    if (end) {
      queryBuilder = queryBuilder.lte('paidAt', `${this.getLocalDateStr(end)}T23:59:59`);
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
      queryBuilder = queryBuilder.gte('scheduledAt', `${this.getLocalDateStr(start)}T00:00:00`);
    }
    if (end) {
      queryBuilder = queryBuilder.lte('scheduledAt', `${this.getLocalDateStr(end)}T23:59:59`);
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
    const startStr = `${this.getLocalDateStr(startDate)}T00:00:00`;

    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('amount, paidAt')
      .gte('paidAt', startStr)
      .order('paidAt', { ascending: true });

    if (error) throw error;

    const byDay: Record<string, number> = {};
    for (const p of payments || []) {
      const day = String(p.paidAt).substring(0, 10);
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
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
    const yearStart = `${now.getFullYear()}-01-01T00:00:00`;

    const { count: activePlans } = await this.supabase
      .from('client_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    const { data: monthPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', monthStart);

    const monthlyRevenue = (monthPayments || []).reduce((sum, p) => sum + p.amount, 0);

    const { data: yearPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .gte('paidAt', yearStart);

    const yearlyRevenue = (yearPayments || []).reduce((sum, p) => sum + p.amount, 0);

    // Histórico de faturamento mensal (últimos 12 meses)
    const monthlyRevenueHistory: { month: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const mEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

      const { data: mPayments } = await this.supabase
        .from('payments')
        .select('amount')
        .gte('paidAt', mStart)
        .lte('paidAt', mEnd);

      monthlyRevenueHistory.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        amount: (mPayments || []).reduce((sum, p) => sum + p.amount, 0),
      });
    }

    // Ocupação dos profissionais (mês atual)
    const { data: professionals } = await this.supabase
      .from('professionals')
      .select('id, name')
      .eq('isActive', true);

    const professionalOccupancy: { id: string; name: string; totalAppointments: number; attendedAppointments: number; occupancyRate: number }[] = [];
    for (const prof of professionals || []) {
      const { data: profAppts } = await this.supabase
        .from('appointments')
        .select('status')
        .eq('professionalId', prof.id)
        .gte('scheduledAt', monthStart)
        .in('status', ['SCHEDULED', 'ATTENDED', 'NO_SHOW']);

      const total = (profAppts || []).length;
      const attended = (profAppts || []).filter((a) => a.status === 'ATTENDED').length;

      professionalOccupancy.push({
        id: prof.id,
        name: prof.name,
        totalAppointments: total,
        attendedAppointments: attended,
        occupancyRate: total > 0 ? Math.round((attended / total) * 100) : 0,
      });
    }

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
      monthlyRevenueHistory,
      professionalOccupancy,
    };
  }
}
