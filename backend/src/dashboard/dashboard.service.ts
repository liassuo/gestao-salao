import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics
   */
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Parallel queries for better performance
    const [
      todayAppointments,
      todayRevenue,
      monthRevenue,
      lastMonthRevenue,
      totalClients,
      activeClients,
      clientsWithDebts,
      totalDebts,
      pendingAppointments,
      totalProfessionals,
    ] = await Promise.all([
      // Today's appointments count
      this.prisma.appointment.count({
        where: {
          scheduledAt: { gte: today, lt: tomorrow },
          status: { in: ['SCHEDULED', 'ATTENDED'] },
        },
      }),

      // Today's revenue
      this.prisma.payment.aggregate({
        where: {
          paidAt: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
      }),

      // This month's revenue
      this.prisma.payment.aggregate({
        where: {
          paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // Last month's revenue
      this.prisma.payment.aggregate({
        where: {
          paidAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),

      // Total clients
      this.prisma.client.count(),

      // Active clients (with appointments in last 30 days)
      this.prisma.client.count({
        where: {
          appointments: {
            some: {
              scheduledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),

      // Clients with debts
      this.prisma.client.count({
        where: { hasDebts: true },
      }),

      // Total pending debts
      this.prisma.debt.aggregate({
        where: { isSettled: false },
        _sum: { remainingBalance: true },
      }),

      // Pending appointments today
      this.prisma.appointment.count({
        where: {
          scheduledAt: { gte: today, lt: tomorrow },
          status: 'SCHEDULED',
        },
      }),

      // Total active professionals
      this.prisma.professional.count({
        where: { isActive: true },
      }),
    ]);

    // Calculate revenue change percentage
    const currentRevenue = monthRevenue._sum.amount || 0;
    const previousRevenue = lastMonthRevenue._sum.amount || 0;
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    return {
      todayAppointments,
      pendingAppointments,
      todayRevenue: todayRevenue._sum.amount || 0,
      monthRevenue: currentRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
      totalClients,
      activeClients,
      clientsWithDebts,
      totalDebts: totalDebts._sum.remainingBalance || 0,
      totalProfessionals,
    };
  }

  /**
   * Get today's appointments
   */
  async getTodayAppointments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ['SCHEDULED', 'ATTENDED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        totalPrice: true,
        isPaid: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
        services: {
          select: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get upcoming appointments (next 7 days)
   */
  async getUpcomingAppointments(limit: number = 10) {
    const now = new Date();

    return this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: now },
        status: 'SCHEDULED',
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      select: {
        id: true,
        scheduledAt: true,
        totalPrice: true,
        client: {
          select: {
            name: true,
          },
        },
        professional: {
          select: {
            name: true,
          },
        },
        services: {
          select: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10) {
    const [recentPayments, recentAppointments, recentDebts] = await Promise.all([
      // Recent payments
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          method: true,
          createdAt: true,
          client: {
            select: { name: true },
          },
        },
      }),

      // Recent appointments
      this.prisma.appointment.findMany({
        where: {
          status: { in: ['ATTENDED', 'CANCELED', 'NO_SHOW'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          client: {
            select: { name: true },
          },
        },
      }),

      // Recent debts created
      this.prisma.debt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          isSettled: true,
          createdAt: true,
          client: {
            select: { name: true },
          },
        },
      }),
    ]);

    // Combine and sort by date
    const activities = [
      ...recentPayments.map((p) => ({
        type: 'payment' as const,
        id: p.id,
        description: `Pagamento de ${p.client.name}`,
        amount: p.amount,
        method: p.method,
        date: p.createdAt,
      })),
      ...recentAppointments.map((a) => ({
        type: 'appointment' as const,
        id: a.id,
        description: `Agendamento ${a.status === 'ATTENDED' ? 'atendido' : a.status === 'CANCELED' ? 'cancelado' : 'não compareceu'} - ${a.client.name}`,
        status: a.status,
        date: a.updatedAt,
      })),
      ...recentDebts.map((d) => ({
        type: 'debt' as const,
        id: d.id,
        description: `${d.isSettled ? 'Dívida quitada' : 'Nova dívida'} - ${d.client.name}`,
        amount: d.amount,
        date: d.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  /**
   * Get revenue by payment method for a period
   */
  async getRevenueByMethod(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate || new Date();

    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        paidAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: true,
    });

    return payments.map((p) => ({
      method: p.method,
      total: p._sum.amount || 0,
      count: p._count,
    }));
  }

  /**
   * Get professional performance
   */
  async getProfessionalPerformance(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate || new Date();

    const professionals = await this.prisma.professional.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        commissionRate: true,
        appointments: {
          where: {
            scheduledAt: { gte: start, lte: end },
            status: 'ATTENDED',
          },
          select: {
            totalPrice: true,
          },
        },
        _count: {
          select: {
            appointments: {
              where: {
                scheduledAt: { gte: start, lte: end },
                status: 'ATTENDED',
              },
            },
          },
        },
      },
    });

    return professionals.map((p) => ({
      id: p.id,
      name: p.name,
      appointmentsCount: p._count.appointments,
      totalRevenue: p.appointments.reduce((sum, a) => sum + a.totalPrice, 0),
      commissionRate: p.commissionRate,
    }));
  }

  /**
   * Get daily revenue for chart (last 30 days)
   */
  async getDailyRevenue(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: { gte: startDate },
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    // Group by date
    const dailyMap = new Map<string, number>();

    // Initialize all days with 0
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      dailyMap.set(dateKey, 0);
    }

    // Sum payments by day
    payments.forEach((p) => {
      const dateKey = new Date(p.paidAt).toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + p.amount);
    });

    return Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));
  }

  /**
   * Get services popularity
   */
  async getServicesPopularity(limit: number = 10) {
    const services = await this.prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        _count: {
          select: {
            appointmentServices: true,
          },
        },
      },
      orderBy: {
        appointmentServices: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      count: s._count.appointmentServices,
    }));
  }
}
