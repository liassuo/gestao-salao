import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  professionalId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate sales report
   */
  async getSalesReport(filters: ReportFilters) {
    const { startDate, endDate, professionalId } = filters;

    const where: any = {
      paidAt: { gte: startDate, lte: endDate },
    };

    if (professionalId) {
      where.appointment = { professionalId };
    }

    const [payments, paymentsByMethod, dailyTotals] = await Promise.all([
      // All payments in period
      this.prisma.payment.findMany({
        where,
        include: {
          client: { select: { name: true } },
          appointment: {
            select: {
              professional: { select: { name: true } },
              services: {
                select: {
                  service: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),

      // Totals by payment method
      this.prisma.payment.groupBy({
        by: ['method'],
        where,
        _sum: { amount: true },
        _count: true,
      }),

      // Daily totals
      this.prisma.payment.findMany({
        where,
        select: {
          amount: true,
          paidAt: true,
        },
      }),
    ]);

    // Calculate daily breakdown
    const dailyMap = new Map<string, number>();
    dailyTotals.forEach((p) => {
      const dateKey = new Date(p.paidAt).toISOString().split('T')[0];
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + p.amount);
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const averageTicket = payments.length > 0 ? totalRevenue / payments.length : 0;

    return {
      period: { startDate, endDate },
      summary: {
        totalRevenue,
        totalTransactions: payments.length,
        averageTicket: Math.round(averageTicket),
      },
      byMethod: paymentsByMethod.map((m) => ({
        method: m.method,
        total: m._sum.amount || 0,
        count: m._count,
        percentage: totalRevenue > 0 ? Math.round(((m._sum.amount || 0) / totalRevenue) * 100) : 0,
      })),
      daily: Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      transactions: payments.map((p) => ({
        id: p.id,
        date: p.paidAt,
        amount: p.amount,
        method: p.method,
        clientName: p.client.name,
        professionalName: p.appointment?.professional?.name || 'N/A',
        services: p.appointment?.services.map((s) => s.service.name).join(', ') || 'N/A',
      })),
    };
  }

  /**
   * Generate professional performance report
   */
  async getProfessionalReport(filters: ReportFilters) {
    const { startDate, endDate, professionalId } = filters;

    const where: any = {
      scheduledAt: { gte: startDate, lte: endDate },
    };

    if (professionalId) {
      where.professionalId = professionalId;
    }

    const professionals = await this.prisma.professional.findMany({
      where: professionalId ? { id: professionalId } : { isActive: true },
      select: {
        id: true,
        name: true,
        commissionRate: true,
        appointments: {
          where: {
            scheduledAt: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            status: true,
            totalPrice: true,
            isPaid: true,
            payment: {
              select: { amount: true },
            },
          },
        },
      },
    });

    return professionals.map((p) => {
      const attended = p.appointments.filter((a) => a.status === 'ATTENDED');
      const canceled = p.appointments.filter((a) => a.status === 'CANCELED');
      const noShow = p.appointments.filter((a) => a.status === 'NO_SHOW');
      const scheduled = p.appointments.filter((a) => a.status === 'SCHEDULED');

      const totalRevenue = attended.reduce(
        (sum, a) => sum + (a.payment?.amount || a.totalPrice),
        0,
      );
      const commissionRate = p.commissionRate ? Number(p.commissionRate) : 0;
      const commission = Math.round(totalRevenue * (commissionRate / 100));

      return {
        id: p.id,
        name: p.name,
        commissionRate,
        stats: {
          total: p.appointments.length,
          attended: attended.length,
          canceled: canceled.length,
          noShow: noShow.length,
          scheduled: scheduled.length,
          attendanceRate:
            p.appointments.length > 0
              ? Math.round((attended.length / p.appointments.length) * 100)
              : 0,
        },
        financial: {
          totalRevenue,
          commission,
          averageTicket: attended.length > 0 ? Math.round(totalRevenue / attended.length) : 0,
        },
      };
    });
  }

  /**
   * Generate services report
   */
  async getServicesReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const services = await this.prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        appointmentServices: {
          where: {
            appointment: {
              scheduledAt: { gte: startDate, lte: endDate },
              status: 'ATTENDED',
            },
          },
          select: {
            appointment: {
              select: { id: true },
            },
          },
        },
      },
    });

    const totalAppointments = services.reduce(
      (sum, s) => sum + s.appointmentServices.length,
      0,
    );

    return services
      .map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        count: s.appointmentServices.length,
        revenue: s.price * s.appointmentServices.length,
        percentage:
          totalAppointments > 0
            ? Math.round((s.appointmentServices.length / totalAppointments) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate clients report
   */
  async getClientsReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    // New clients in period
    const newClients = await this.prisma.client.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Active clients (had appointments in period)
    const activeClients = await this.prisma.client.findMany({
      where: {
        appointments: {
          some: {
            scheduledAt: { gte: startDate, lte: endDate },
          },
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        appointments: {
          where: {
            scheduledAt: { gte: startDate, lte: endDate },
          },
          select: {
            status: true,
            totalPrice: true,
            payment: {
              select: { amount: true },
            },
          },
        },
      },
    });

    // Top clients by spending
    const topClients = activeClients
      .map((c) => {
        const attended = c.appointments.filter((a) => a.status === 'ATTENDED');
        const totalSpent = attended.reduce(
          (sum, a) => sum + (a.payment?.amount || a.totalPrice),
          0,
        );
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          appointmentsCount: attended.length,
          totalSpent,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20);

    // Clients with debts
    const clientsWithDebts = await this.prisma.client.findMany({
      where: { hasDebts: true },
      select: {
        id: true,
        name: true,
        phone: true,
        debts: {
          where: { isSettled: false },
          select: {
            amount: true,
            remainingBalance: true,
            createdAt: true,
          },
        },
      },
    });

    const totalDebt = clientsWithDebts.reduce(
      (sum, c) => sum + c.debts.reduce((s, d) => s + d.remainingBalance, 0),
      0,
    );

    return {
      summary: {
        newClients,
        activeClients: activeClients.length,
        clientsWithDebts: clientsWithDebts.length,
        totalDebt,
      },
      topClients,
      debtors: clientsWithDebts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalDebt: c.debts.reduce((s, d) => s + d.remainingBalance, 0),
        debtsCount: c.debts.length,
      })),
    };
  }

  /**
   * Generate debts report
   */
  async getDebtsReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const [debtsCreated, debtsPaid, currentDebts] = await Promise.all([
      // Debts created in period
      this.prisma.debt.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          client: { select: { name: true, phone: true } },
        },
      }),

      // Debts paid in period
      this.prisma.debt.findMany({
        where: {
          paidAt: { gte: startDate, lte: endDate },
          isSettled: true,
        },
        include: {
          client: { select: { name: true } },
        },
      }),

      // All current open debts
      this.prisma.debt.findMany({
        where: { isSettled: false },
        include: {
          client: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalCreated = debtsCreated.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = debtsPaid.reduce((sum, d) => sum + d.amount, 0);
    const totalOutstanding = currentDebts.reduce((sum, d) => sum + d.remainingBalance, 0);

    return {
      summary: {
        debtsCreatedCount: debtsCreated.length,
        totalCreated,
        debtsPaidCount: debtsPaid.length,
        totalPaid,
        currentDebtsCount: currentDebts.length,
        totalOutstanding,
      },
      created: debtsCreated.map((d) => ({
        id: d.id,
        clientName: d.client.name,
        clientPhone: d.client.phone,
        amount: d.amount,
        description: d.description,
        createdAt: d.createdAt,
      })),
      outstanding: currentDebts.map((d) => ({
        id: d.id,
        clientName: d.client.name,
        clientPhone: d.client.phone,
        amount: d.amount,
        amountPaid: d.amountPaid,
        remainingBalance: d.remainingBalance,
        dueDate: d.dueDate,
        createdAt: d.createdAt,
        daysPending: Math.floor(
          (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  }

  /**
   * Generate daily cash register report
   */
  async getCashRegisterReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    const registers = await this.prisma.cashRegister.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      include: {
        openedByUser: { select: { name: true } },
        closedByUser: { select: { name: true } },
        payments: {
          select: {
            amount: true,
            method: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const summary = registers.reduce(
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
        daysCount: registers.length,
        averageDaily: registers.length > 0 ? Math.round(summary.totalRevenue / registers.length) : 0,
      },
      registers: registers.map((r) => ({
        id: r.id,
        date: r.date,
        openedBy: r.openedByUser.name,
        closedBy: r.closedByUser?.name || null,
        isOpen: r.isOpen,
        openingBalance: r.openingBalance,
        closingBalance: r.closingBalance,
        totalCash: r.totalCash,
        totalPix: r.totalPix,
        totalCard: r.totalCard,
        totalRevenue: r.totalRevenue,
        discrepancy: r.discrepancy,
        transactionsCount: r.payments.length,
      })),
    };
  }
}
