import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { fetchPaymentsByBusinessDate, isRevenuePayment } from '../common/business-date.helper';
import { CommissionsService } from '../commissions/commissions.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { AsaasService } from '../asaas/asaas.service';

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
    private readonly asaasService: AsaasService,
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

    // Origem do pagamento: APP = cobrança paga pelo gateway Asaas (tem asaasPaymentId);
    // PRESENCIAL = pago pessoalmente (dinheiro, maquininha física, PIX manual digitado),
    // sem passar pelo app. Mesmo discriminador da tela Conciliação Asaas.
    const byOrigin = {
      PRESENCIAL: { total: 0, count: 0 },
      APP: { total: 0, count: 0 },
    };

    for (const payment of payments || []) {
      const method = payment.method as keyof typeof byMethod;
      if (byMethod[method]) {
        byMethod[method].total += payment.amount;
        byMethod[method].count += 1;
      }
      const origin = payment.asaasPaymentId ? 'APP' : 'PRESENCIAL';
      byOrigin[origin].total += payment.amount;
      byOrigin[origin].count += 1;
    }

    // Enriquece as transações para a tabela do relatório. O front espera
    // { id, date, amount, method, clientName, professionalName, services }; antes
    // devolvíamos a linha CRUA de payments (sem date/clientName/professionalName/
    // services), então a tela mostrava "Data inválida" e Cliente/Profissional/
    // Serviços em branco. A data exibida é o DIA CONTÁBIL (businessDate, fallback
    // paidAt), coerente com o restante do relatório.
    const CHUNK = 300; // .in serializa na query string — busca em lotes (igual getServicesReport)

    // Cliente: payments.clientId → clients.name.
    const clientIds = [
      ...new Set((payments.map((p) => p.clientId).filter(Boolean) as string[])),
    ];
    const clientNameById = new Map<string, string>();
    for (let i = 0; i < clientIds.length; i += CHUNK) {
      const batch = clientIds.slice(i, i + CHUNK);
      const { data, error } = await this.supabase
        .from('clients')
        .select('id, name')
        .in('id', batch);
      if (error) throw error;
      for (const c of data || []) clientNameById.set(c.id, c.name);
    }

    // Comanda (order) ligada ao pagamento por orders.paymentId — traz o profissional
    // e os serviços. Pagamentos sem comanda (assinatura, avulso, manual) ficam sem
    // profissional/serviços, mas ainda exibem data/cliente/valor/método.
    // NÃO embutimos professionals aqui: `orders` tem DUAS FKs para professionals
    // (professionalId e consumerProfessionalId), então o embed `professionals(...)`
    // é ambíguo no PostgREST (PGRST201) e fazia o relatório inteiro falhar. Trazemos
    // só professionalId no order e resolvemos o nome num fetch em lote separado.
    const paymentIds = payments.map((p) => p.id);
    const orderByPaymentId = new Map<string, any>();
    for (let i = 0; i < paymentIds.length; i += CHUNK) {
      const batch = paymentIds.slice(i, i + CHUNK);
      const { data, error } = await this.supabase
        .from('orders')
        .select(
          'paymentId, professionalId, items:order_items(itemType, service:services(name))',
        )
        .in('paymentId', batch);
      if (error) throw error;
      for (const o of data || []) {
        if ((o as any).paymentId) orderByPaymentId.set((o as any).paymentId, o);
      }
    }

    // Nome do profissional por id (das comandas acima), em lote.
    const professionalIds = [
      ...new Set(
        ([...orderByPaymentId.values()]
          .map((o) => o.professionalId)
          .filter(Boolean)) as string[],
      ),
    ];
    const professionalNameById = new Map<string, string>();
    for (let i = 0; i < professionalIds.length; i += CHUNK) {
      const batch = professionalIds.slice(i, i + CHUNK);
      const { data, error } = await this.supabase
        .from('professionals')
        .select('id, name')
        .in('id', batch);
      if (error) throw error;
      for (const pr of data || []) professionalNameById.set(pr.id, pr.name);
    }

    const transactions = payments.map((p) => {
      const order = orderByPaymentId.get(p.id);
      const serviceNames = ((order?.items || []) as any[])
        .filter((it) => it.itemType === 'SERVICE')
        .map((it) => {
          // Embed do PostgREST pode vir como objeto (to-one) ou array — normaliza.
          const svc = Array.isArray(it.service) ? it.service[0] : it.service;
          return svc?.name ?? null;
        })
        .filter(Boolean);
      return {
        id: p.id,
        date: p.businessDate ?? p.paidAt ?? null,
        amount: p.amount,
        method: p.method,
        origin: p.asaasPaymentId ? 'APP' : 'PRESENCIAL',
        clientName: p.clientId ? clientNameById.get(p.clientId) ?? null : null,
        professionalName: order?.professionalId
          ? professionalNameById.get(order.professionalId) ?? null
          : null,
        services: serviceNames.join(', '),
      };
    });

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
      byOrigin: Object.entries(byOrigin).map(([origin, data]) => ({
        origin,
        total: data.total,
        count: data.count,
        percentage: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0,
      })),
      transactions,
    };
  }

  async getProfessionalReport(filters: ReportFilters) {
    const { startDate, endDate, professionalId } = filters;

    // Comissão usa a MESMA regra da tela Comissões (avulso×taxa + pote de assinatura
    // 50%/fichas + produtos×taxa), para os números baterem entre as duas telas. Antes
    // este relatório fazia receita×taxa, ignorando pote e produtos — divergia. O pote é
    // GLOBAL (depende das fichas de todos os profissionais), então calculamos uma única
    // vez e indexamos por profissional. Também serve para saber QUEM teve atividade no
    // período.
    const commissionBreakdown =
      await this.commissionsService.computeCommissionBreakdownForPeriod(
        startDate,
        endDate,
      );
    const commissionByProfessional = new Map(
      commissionBreakdown.map((b) => [b.professionalId, b.amount]),
    );

    // Inclui profissionais ATIVOS + qualquer um com atendimento/venda no período (mesmo
    // desativado depois) — senão a receita/comissão de um profissional desligado sumia
    // do relatório, divergindo do caixa/comissões (M2).
    let query = this.supabase
      .from('professionals')
      .select('id, name, commissionRate, isActive');

    if (professionalId) {
      query = query.eq('id', professionalId);
    }

    const { data: allProfessionals } = await query;
    const professionals = (allProfessionals || []).filter(
      (p) => p.isActive || commissionByProfessional.has(p.id),
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

  /**
   * Conciliação Asaas: para cada pagamento com asaasPaymentId no período, compara o
   * BRUTO cobrado pelo app (payments.amount, centavos) com o que o Asaas registrou —
   * `value` (bruto) e `netValue` (LÍQUIDO, já descontada a taxa do gateway). O banco
   * só guarda o bruto; o líquido vive no Asaas (getCharge). Serve para responder
   * "chegou menos que deveria?": geralmente é a TAXA (value − netValue); se o bruto
   * do app != value do Asaas, é divergência real de registro a investigar.
   *
   * Tudo em centavos (value/netValue do Asaas vêm em reais → ×100).
   */
  // Teto de cobranças consultadas num único request: cada uma é uma chamada HTTP ao
  // Asaas. Sem teto, um período largo dispararia centenas de getCharge sequenciais —
  // estoura o TimeoutInterceptor (30s) e arrisca rate-limit (429) na chave do Asaas.
  private static readonly ASAAS_RECON_MAX = 300;

  async getAsaasReconciliation(filters: ReportFilters) {
    const { startDate, endDate } = filters;
    const MAX = ReportsService.ASAAS_RECON_MAX;

    const emptySummary = {
      count: 0,
      okCount: 0,
      divergentCount: 0,
      refundedCount: 0,
      pendingNetCount: 0,
      errorCount: 0,
      totalAppAmountCentavos: 0,
      totalAsaasValueCentavos: 0,
      totalAsaasNetCentavos: 0,
      totalFeeCentavos: 0,
    };

    if (!this.asaasService.configured) {
      return {
        configured: false,
        truncated: false,
        message:
          'Asaas não configurado (defina ASAAS_API_KEY). Sem isso não dá para puxar o valor líquido recebido.',
        period: { startDate, endDate },
        items: [] as any[],
        summary: emptySummary,
      };
    }

    // Pagamentos com cobrança Asaas pagos no período (pela data REAL do pagamento,
    // paidAt — alinha com a régua de liquidação do gateway, não com o dia contábil).
    // Mais recentes primeiro + teto (MAX) para limitar o nº de getCharge por request.
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select(
        'id, asaasPaymentId, amount, method, billingType, asaasStatus, paidAt, businessDate, clientId',
      )
      .not('asaasPaymentId', 'is', null)
      .gte('paidAt', startDate)
      .lte('paidAt', endDate)
      .order('paidAt', { ascending: false })
      .limit(MAX);

    if (error) {
      throw new Error(`Falha ao buscar pagamentos Asaas: ${error.message}`);
    }

    const list = payments || [];
    const truncated = list.length >= MAX; // atingiu o teto → pode haver mais fora do relatório

    // Consulta o Asaas em lotes pequenos para não estourar rate limit; um erro numa
    // cobrança não derruba o relatório (a linha vem marcada com error/ERRO_CONSULTA).
    const items: any[] = [];
    const CHUNK = 5;
    for (let i = 0; i < list.length; i += CHUNK) {
      const batch = list.slice(i, i + CHUNK);
      const settled = await Promise.all(batch.map((p) => this.reconcileOneAsaasCharge(p)));
      items.push(...settled);
    }

    // Taxa/líquido só somam linhas com taxa conhecida (feeCentavos != null): exclui
    // estorno (ESTORNADO), liquidação sem líquido publicado (AGUARDANDO_LIQUIDO) e erro.
    const withFee = items.filter((i) => i.feeCentavos != null);
    const revenueValue = items.filter(
      (i) => !i.error && i.status !== 'ESTORNADO' && i.asaasValueCentavos != null,
    );
    const summary = {
      count: items.length,
      okCount: items.filter((i) => i.status === 'OK' || i.status === 'OK_COM_TAXA').length,
      divergentCount: items.filter((i) => i.status === 'VALOR_DIVERGENTE').length,
      refundedCount: items.filter((i) => i.status === 'ESTORNADO').length,
      pendingNetCount: items.filter((i) => i.status === 'AGUARDANDO_LIQUIDO').length,
      errorCount: items.filter((i) => i.error).length,
      totalAppAmountCentavos: items.reduce((s, i) => s + (i.appAmountCentavos || 0), 0),
      totalAsaasValueCentavos: revenueValue.reduce((s, i) => s + i.asaasValueCentavos, 0),
      totalAsaasNetCentavos: withFee.reduce((s, i) => s + i.asaasNetCentavos, 0),
      totalFeeCentavos: withFee.reduce((s, i) => s + i.feeCentavos, 0),
    };

    return {
      configured: true,
      truncated,
      period: { startDate, endDate },
      items,
      summary,
    };
  }

  private async reconcileOneAsaasCharge(p: any) {
    const base = {
      paymentId: p.id,
      asaasPaymentId: p.asaasPaymentId,
      clientId: p.clientId,
      method: p.method,
      billingType: p.billingType,
      paidAt: p.paidAt,
      businessDate: p.businessDate,
      localStatus: p.asaasStatus,
      appAmountCentavos: p.amount,
    };
    try {
      const charge = await this.asaasService.getCharge(p.asaasPaymentId);
      const asaasValueCentavos = Math.round((charge.value || 0) * 100);
      const netCentavos =
        charge.netValue != null ? Math.round(charge.netValue * 100) : null;
      const divergent = p.amount !== asaasValueCentavos;

      // Estorno/cancelamento/chargeback: dinheiro que SAIU, não é taxa de gateway.
      // Marca ESTORNADO e não deixa value−net virar uma "taxa" fantasma nos totais.
      if (!isRevenuePayment({ asaasStatus: charge.status })) {
        return {
          ...base,
          asaasStatus: charge.status,
          asaasValueCentavos,
          asaasNetCentavos: netCentavos,
          feeCentavos: null,
          divergent: false,
          error: false,
          status: 'ESTORNADO',
        };
      }

      // Divergência de VALOR (app != value do Asaas) é o sinal prioritário a investigar.
      if (divergent) {
        return {
          ...base,
          asaasStatus: charge.status,
          asaasValueCentavos,
          asaasNetCentavos: netCentavos,
          feeCentavos: netCentavos != null ? asaasValueCentavos - netCentavos : null,
          divergent: true,
          error: false,
          status: 'VALOR_DIVERGENTE',
        };
      }

      // Liquidada, mas o Asaas ainda não publicou o líquido → não inventa taxa 0.
      if (netCentavos == null) {
        return {
          ...base,
          asaasStatus: charge.status,
          asaasValueCentavos,
          asaasNetCentavos: null,
          feeCentavos: null,
          divergent: false,
          error: false,
          status: 'AGUARDANDO_LIQUIDO',
        };
      }

      const feeCentavos = asaasValueCentavos - netCentavos;
      return {
        ...base,
        asaasStatus: charge.status,
        asaasValueCentavos,
        asaasNetCentavos: netCentavos,
        feeCentavos,
        divergent: false,
        error: false,
        status: feeCentavos > 0 ? 'OK_COM_TAXA' : 'OK',
      };
    } catch (e: any) {
      return {
        ...base,
        asaasStatus: null,
        asaasValueCentavos: null,
        asaasNetCentavos: null,
        feeCentavos: null,
        divergent: false,
        error: true,
        status: 'ERRO_CONSULTA',
        errorMessage: String(e?.message || e),
      };
    }
  }
}
