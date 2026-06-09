import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { fetchPaymentsByBusinessDate } from '../common/business-date.helper';
import { CommissionsService } from '../commissions/commissions.service';
import { CashRegisterService } from '../cash-register/cash-register.service';

export interface ReportFilters {
  startDate: string; // "YYYY-MM-DDT00:00:00"
  endDate: string;   // "YYYY-MM-DDT23:59:59"
  professionalId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly commissionsService: CommissionsService,
    private readonly cashRegisterService: CashRegisterService,
  ) {}

  async getSalesReport(filters: ReportFilters) {
    const { startDate, endDate } = filters;

    // Relatório de vendas pelo DIA CONTÁBIL (businessDate, fallback paidAt) —
    // coerente com o caixa e o dashboard.
    const fetched = await fetchPaymentsByBusinessDate(
      this.supabase,
      '*',
      startDate,
      endDate,
    );
    const payments = fetched.sort((a, b) =>
      String(b.businessDate ?? b.paidAt ?? '').localeCompare(
        String(a.businessDate ?? a.paidAt ?? ''),
      ),
    );

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const averageTicket = payments.length > 0 ? totalRevenue / payments.length : 0;

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

    // Comissão usa a MESMA regra da tela Comissões (avulso×taxa + pote de assinatura
    // 50%/fichas + produtos×taxa), para os números baterem entre as duas telas. Antes
    // este relatório fazia receita×taxa, ignorando pote e produtos — divergia. O pote é
    // GLOBAL (depende das fichas de todos os profissionais), então calculamos uma única
    // vez e indexamos por profissional.
    const commissionBreakdown =
      await this.commissionsService.computeCommissionBreakdownForPeriod(
        startDate,
        endDate,
      );
    const commissionByProfessional = new Map(
      commissionBreakdown.map((b) => [b.professionalId, b.amount]),
    );

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
      const commission = commissionByProfessional.get(professional.id) || 0;

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

    // 1. Catálogo de serviços ATIVOS — base do relatório (aparecem mesmo com 0 atendimentos).
    const { data: services, error: servicesError } = await this.supabase
      .from('services')
      .select('id, name, price, duration')
      .eq('isActive', true);
    if (servicesError) throw servicesError;

    type ServiceRow = {
      name: string;
      price: number;
      duration: number;
      count: number;
      revenue: number;
      hadPromotion: boolean;
    };
    const serviceMap = new Map<string, ServiceRow>();
    for (const s of services || []) {
      serviceMap.set(s.id, {
        name: s.name,
        price: s.price,
        duration: s.duration,
        count: 0,
        revenue: 0,
        hadPromotion: false,
      });
    }

    // 2. Agendamentos ATTENDED no período (a "data do serviço" é o scheduledAt).
    const { data: appointments, error: appointmentsError } = await this.supabase
      .from('appointments')
      .select('id')
      .eq('status', 'ATTENDED')
      .gte('scheduledAt', startDate)
      .lte('scheduledAt', endDate);
    if (appointmentsError) throw appointmentsError;

    const appointmentIds = (appointments || []).map((a) => a.id);

    // 3. Itens de serviço das comandas desses atendimentos. A receita vem do unitPrice
    //    REALMENTE cobrado (snapshot no atendimento): corte coberto pela assinatura =
    //    R$0, descontos/promoções já aplicados, e imune a reajuste posterior do preço de
    //    cadastro. Antes o relatório somava service.price ATUAL, inflando a receita (o
    //    corte de assinatura contava pela tarifa cheia) e reescrevendo o histórico quando
    //    o preço mudava — por isso "não batia" com Vendas/Caixa/Dashboard.
    // Busca em LOTES para não estourar o limite de tamanho da URL do PostgREST com a
    // lista de ids (.in serializa na query string). Comandas CANCELED são EXCLUÍDAS — o
    // cancelamento só troca o status e mantém os order_items, que senão inflariam a
    // receita. Comandas PENDING (atendidas, ainda não pagas) CONTAM: este é o relatório
    // de "serviços realizados", não de caixa recebido (por isso pode divergir de Vendas).
    const CHUNK = 300;
    const orders: any[] = [];
    for (let i = 0; i < appointmentIds.length; i += CHUNK) {
      const batch = appointmentIds.slice(i, i + CHUNK);
      const { data, error } = await this.supabase
        .from('orders')
        .select(
          'appointmentId, status, items:order_items(serviceId, unitPrice, quantity, itemType, service:services(id, name, price, duration))',
        )
        .neq('status', 'CANCELED')
        .in('appointmentId', batch);
      if (error) throw error;
      if (data) orders.push(...data);
    }

    for (const order of orders) {
      for (const item of (order as any).items || []) {
        if (item.itemType !== 'SERVICE' || !item.serviceId) continue;

        let entry = serviceMap.get(item.serviceId);
        if (!entry) {
          // Serviço descontinuado (inativo) que teve atendimento no período: não pode
          // sumir do relatório. Usa nome/preço/duração vindos do join do item.
          const svc = item.service;
          entry = {
            name: svc?.name || 'Serviço removido',
            price: svc?.price || 0,
            duration: svc?.duration || 0,
            count: 0,
            revenue: 0,
            hadPromotion: false,
          };
          serviceMap.set(item.serviceId, entry);
        }

        // unitPrice é POR UNIDADE; um item de serviço pode ter quantity > 1 (extra
        // lançado na comanda). Conta e fatura pela quantidade, como a tela Comissões.
        const unitPrice = item.unitPrice || 0;
        const qty = item.quantity || 1;
        entry.count += qty;
        entry.revenue += unitPrice * qty;
        // Cobrado abaixo do preço de cadastro (sem ser zerado pela assinatura) =
        // houve desconto/promoção no atendimento.
        if (unitPrice > 0 && unitPrice < entry.price) entry.hadPromotion = true;
      }
    }

    // 4. Totais e percentuais.
    const totalRevenue = Array.from(serviceMap.values()).reduce(
      (sum, s) => sum + s.revenue,
      0,
    );

    return Array.from(serviceMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        price: data.price,
        duration: data.duration,
        count: data.count,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
        hadPromotion: data.hadPromotion,
      }))
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

    // Caixa AINDA ABERTO tem totalCash/Pix/Card/Revenue nulos (só preenchidos no
    // fechamento). Recalcula em tempo real para o relatório não subnotificar o dia
    // corrente — senão "Total Faturado" do mês fica abaixo do real (Dashboard/Vendas,
    // que contam payments, já mostram a receita do dia aberto).
    const enrichedRegisters = await Promise.all(
      (registers || []).map(async (r) => {
        if (!r.isOpen) return r;
        const totals = await this.cashRegisterService.calculateDailyTotals(r.date);
        return {
          ...r,
          totalCash: totals.cash,
          totalPix: totals.pix,
          totalCard: totals.card,
          totalRevenue: totals.total,
        };
      }),
    );

    const summary = enrichedRegisters.reduce(
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
        daysCount: enrichedRegisters.length,
        averageDaily: enrichedRegisters.length > 0 ? Math.round(summary.totalRevenue / enrichedRegisters.length) : 0,
      },
      registers: enrichedRegisters,
    };
  }
}
