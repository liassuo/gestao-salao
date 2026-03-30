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

    // Paraleliza todas as 9 queries independentes (era sequencial)
    const [
      { count: todayAppointments },
      { data: todayPayments },
      { data: monthPayments },
      { count: totalClients },
      { count: clientsWithDebts },
      { data: debts },
      { count: pendingAppointments },
      { count: totalProfessionals },
      { count: activeClients },
    ] = await Promise.all([
      this.supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('scheduledAt', todayStart)
        .lte('scheduledAt', todayEnd)
        .in('status', ['SCHEDULED', 'ATTENDED']),
      this.supabase
        .from('payments')
        .select('amount')
        .gte('paidAt', todayStart)
        .lte('paidAt', todayEnd),
      this.supabase
        .from('payments')
        .select('amount')
        .gte('paidAt', monthStart),
      this.supabase
        .from('clients')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('hasDebts', true),
      this.supabase
        .from('debts')
        .select('remainingBalance')
        .eq('isSettled', false),
      this.supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('scheduledAt', todayStart)
        .lte('scheduledAt', todayEnd)
        .eq('status', 'SCHEDULED'),
      this.supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('isActive', true),
      this.supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('isActive', true),
    ]);

    const todayRevenue = (todayPayments || []).reduce((sum, p) => sum + p.amount, 0);
    const monthRevenue = (monthPayments || []).reduce((sum, p) => sum + p.amount, 0);
    const totalDebts = (debts || []).reduce((sum, d) => sum + d.remainingBalance, 0);

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
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    // Paraleliza todas as 6 queries independentes
    const [
      { count: activeProfessionals },
      { count: openOrders },
      { count: totalClients },
      { data: allAttended },
      { data: allClients },
      { data: debts },
    ] = await Promise.all([
      this.supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('isActive', true),
      this.supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      this.supabase
        .from('clients')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('appointments')
        .select('clientId, totalPrice, client:clients(id, name, phone)')
        .eq('status', 'ATTENDED'),
      this.supabase
        .from('clients')
        .select('id, name, phone, birthDate')
        .eq('isActive', true)
        .not('birthDate', 'is', null),
      this.supabase
        .from('debts')
        .select('clientId, remainingBalance, client:clients(id, name, phone)')
        .eq('isSettled', false)
        .gt('remainingBalance', 0),
    ]);

    // Top 5 clientes por gasto
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

    // Clientes com dívidas em aberto
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

    // Busca o range completo de 12 meses em UMA query ao invés de 12 sequenciais
    const oldestMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const yearHistoryStart = `${oldestMonth.getFullYear()}-${String(oldestMonth.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;

    // Paraleliza todas as queries independentes (era sequencial: ~16 queries → 4 paralelas)
    const [
      { count: activePlans },
      { data: allPayments12m },
      { data: professionals },
      { data: monthAppointments },
    ] = await Promise.all([
      this.supabase
        .from('client_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
      this.supabase
        .from('payments')
        .select('amount, paidAt')
        .gte('paidAt', yearHistoryStart),
      this.supabase
        .from('professionals')
        .select('id, name')
        .eq('isActive', true),
      this.supabase
        .from('appointments')
        .select('professionalId, status')
        .gte('scheduledAt', monthStart)
        .in('status', ['SCHEDULED', 'ATTENDED', 'NO_SHOW']),
    ]);

    // Calcula receita mensal e anual a partir dos dados já em memória
    const yearStart = `${now.getFullYear()}-01-01T00:00:00`;
    let monthlyRevenue = 0;
    let yearlyRevenue = 0;
    const monthlyBuckets: Record<string, number> = {};

    for (const p of allPayments12m || []) {
      const paidMonth = String(p.paidAt).substring(0, 7); // "YYYY-MM"
      monthlyBuckets[paidMonth] = (monthlyBuckets[paidMonth] || 0) + p.amount;

      if (p.paidAt >= yearStart) yearlyRevenue += p.amount;
      if (p.paidAt >= monthStart) monthlyRevenue += p.amount;
    }

    // Histórico mensal — monta a partir do bucket (sem queries adicionais)
    const monthlyRevenueHistory: { month: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenueHistory.push({
        month: monthKey,
        amount: monthlyBuckets[monthKey] || 0,
      });
    }

    // Ocupação — agrega em memória (sem N+1 queries por profissional)
    const profMap = new Map<string, { total: number; attended: number }>();
    for (const a of monthAppointments || []) {
      const entry = profMap.get(a.professionalId) || { total: 0, attended: 0 };
      entry.total++;
      if (a.status === 'ATTENDED') entry.attended++;
      profMap.set(a.professionalId, entry);
    }

    const professionalOccupancy = (professionals || []).map((prof) => {
      const stats = profMap.get(prof.id) || { total: 0, attended: 0 };
      return {
        id: prof.id,
        name: prof.name,
        totalAppointments: stats.total,
        attendedAppointments: stats.attended,
        occupancyRate: stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
      };
    });

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
