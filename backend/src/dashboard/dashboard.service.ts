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

  /**
   * Get operational dashboard data
   */
  async getOperationalData() {
    const [
      activeProfessionals,
      openOrders,
      totalClients,
      topClients,
      lowStockProducts,
      unpaidClients,
    ] = await Promise.all([
      // Active professionals count
      this.prisma.professional.count({
        where: { isActive: true },
      }),

      // Open (PENDING) orders count
      this.prisma.order.count({
        where: { status: 'PENDING' },
      }),

      // Total clients count
      this.prisma.client.count(),

      // Top clients by spending (top 5)
      this.getTopClients(),

      // Low stock products
      this.getLowStockProducts(),

      // Clients with unpaid appointments
      this.getUnpaidClients(),
    ]);

    return {
      activeProfessionals,
      openOrders,
      totalClients,
      topClients,
      lowStockProducts,
      unpaidClients,
    };
  }

  /**
   * Get top 5 clients by total spending
   */
  private async getTopClients() {
    const clients = await this.prisma.client.findMany({
      select: {
        id: true,
        name: true,
        payments: {
          select: {
            id: true,
            amount: true,
            appointmentId: true,
          },
        },
        orders: {
          where: { paymentId: { not: null } },
          select: {
            payment: {
              select: {
                amount: true,
              },
            },
          },
        },
        subscription: {
          select: {
            status: true,
            plan: {
              select: {
                price: true,
              },
            },
          },
        },
      },
    });

    const clientsWithTotals = clients.map((client) => {
      // Sum payment amounts for services (payments with appointmentId)
      const totalServices = client.payments
        .filter((p) => p.appointmentId !== null)
        .reduce((sum, p) => sum + p.amount, 0);

      // Sum payment amounts for products (payments linked to orders via order.paymentId)
      const totalProducts = client.orders.reduce(
        (sum, o) => sum + (o.payment?.amount || 0),
        0,
      );

      // Subscription plan price (if client has an active subscription)
      const totalSubscription =
        client.subscription && client.subscription.status === 'ACTIVE'
          ? client.subscription.plan.price
          : 0;

      const total = totalServices + totalProducts + totalSubscription;

      return {
        id: client.id,
        name: client.name,
        totalServices,
        totalProducts,
        totalSubscription,
        total,
      };
    });

    // Sort by total descending, take top 5
    return clientsWithTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }

  /**
   * Get products with stock below minimum
   */
  private async getLowStockProducts() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        minStock: true,
        stockMovements: {
          select: {
            type: true,
            quantity: true,
          },
        },
      },
    });

    return products
      .map((product) => {
        const entries = product.stockMovements
          .filter((m) => m.type === 'ENTRY')
          .reduce((sum, m) => sum + m.quantity, 0);

        const exits = product.stockMovements
          .filter((m) => m.type === 'EXIT')
          .reduce((sum, m) => sum + m.quantity, 0);

        const currentStock = entries - exits;

        return {
          id: product.id,
          name: product.name,
          currentStock,
          minStock: product.minStock,
        };
      })
      .filter((product) => product.currentStock < product.minStock);
  }

  /**
   * Get clients with unpaid attended appointments
   */
  private async getUnpaidClients() {
    const clients = await this.prisma.client.findMany({
      where: {
        appointments: {
          some: {
            status: 'ATTENDED',
            isPaid: false,
          },
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        appointments: {
          where: {
            status: 'ATTENDED',
            isPaid: false,
          },
          select: {
            totalPrice: true,
          },
        },
      },
    });

    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      unpaidAmount: client.appointments.reduce(
        (sum, a) => sum + a.totalPrice,
        0,
      ),
      unpaidCount: client.appointments.length,
    }));
  }

  /**
   * Get strategic dashboard data
   */
  async getStrategicData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const twelveMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1,
    );

    const [
      activePlans,
      soldThisMonth,
      canceledThisMonth,
      monthlyRevenue,
      yearlyRevenue,
      paymentsLast12Months,
      professionalOccupancy,
    ] = await Promise.all([
      // Active subscriptions
      this.prisma.clientSubscription.count({
        where: { status: 'ACTIVE' },
      }),

      // Subscriptions sold this month
      this.prisma.clientSubscription.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),

      // Subscriptions canceled this month
      this.prisma.clientSubscription.count({
        where: {
          status: 'CANCELED',
          updatedAt: { gte: startOfMonth },
        },
      }),

      // Monthly revenue (this month)
      this.prisma.payment.aggregate({
        where: {
          paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // Yearly revenue
      this.prisma.payment.aggregate({
        where: {
          paidAt: { gte: startOfYear },
        },
        _sum: { amount: true },
      }),

      // Payments from last 12 months (for monthly history)
      this.prisma.payment.findMany({
        where: {
          paidAt: { gte: twelveMonthsAgo },
        },
        select: {
          amount: true,
          paidAt: true,
        },
      }),

      // Professional occupancy this month
      this.getProfessionalOccupancy(startOfMonth),
    ]);

    // Build monthly revenue history
    const monthlyMap = new Map<string, number>();

    // Initialize last 12 months with 0
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(monthKey, 0);
    }

    // Sum payments by month
    paymentsLast12Months.forEach((p) => {
      const date = new Date(p.paidAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + p.amount);
      }
    });

    const monthlyRevenueHistory = Array.from(monthlyMap.entries()).map(
      ([month, amount]) => ({ month, amount }),
    );

    return {
      plans: {
        activePlans,
        soldThisMonth,
        canceledThisMonth,
      },
      revenue: {
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        yearlyRevenue: yearlyRevenue._sum.amount || 0,
      },
      monthlyRevenueHistory,
      professionalOccupancy,
    };
  }

  /**
   * Get professional occupancy rates for the current month
   */
  private async getProfessionalOccupancy(startOfMonth: Date) {
    const professionals = await this.prisma.professional.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        appointments: {
          where: {
            scheduledAt: { gte: startOfMonth },
            status: { in: ['SCHEDULED', 'ATTENDED'] },
          },
          select: {
            status: true,
          },
        },
      },
    });

    return professionals.map((p) => {
      const totalAppointments = p.appointments.length;
      const attendedAppointments = p.appointments.filter(
        (a) => a.status === 'ATTENDED',
      ).length;
      const occupancyRate =
        totalAppointments > 0
          ? Math.round((attendedAppointments / totalAppointments) * 100 * 10) / 10
          : 0;

      return {
        id: p.id,
        name: p.name,
        totalAppointments,
        attendedAppointments,
        occupancyRate,
      };
    });
  }
}
