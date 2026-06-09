import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { ProfessionalDebtsService } from '../professional-debts/professional-debts.service';
import { isRevenuePayment } from '../common/business-date.helper';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';

/**
 * Regra fixa de assinaturas: a barbearia fica com metade da receita
 * mensal das assinaturas e a outra metade vira pote dividido entre os
 * barbeiros proporcionalmente às fichas atendidas no período.
 * O commissionRate individual NÃO se aplica nesse pote — só em cortes
 * avulsos e produtos.
 */
const SUBSCRIPTION_BARBER_POOL_PERCENT = 50;

@Injectable()
export class CommissionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly professionalDebtsService: ProfessionalDebtsService,
  ) {}

  async generate(dto: GenerateCommissionDto) {
    if (dto.periodStart >= dto.periodEnd) {
      throw new BadRequestException('A data de início deve ser anterior à data de fim');
    }

    const startStr = `${dto.periodStart}T00:00:00`;
    const endStr = `${dto.periodEnd}T23:59:59`;

    // Regerar comissoes e idempotente: apagamos qualquer PENDING sobreposta e
    // recriamos do zero. So bloqueamos hard se houver comissao PAID sobreposta —
    // ai admin precisa decidir manualmente o que fazer (excluir/refund/etc).
    //
    // "Sobreposta" = periodo da comissao existente cruza o novo periodo, mesmo que
    // datas nao batam exatamente. Isso evita duplicacao quando alguem gera "Semana"
    // e depois "Mes todo" sem perceber que se sobrepoem.
    const { data: overlapping } = await this.supabase
      .from('commissions')
      .select('id, status, periodStart, periodEnd, professional:professionals(name)')
      .lte('periodStart', endStr)
      .gte('periodEnd', startStr);

    if (overlapping && overlapping.length > 0) {
      const paidOverlaps = overlapping.filter((c: any) => c.status === 'PAID');
      if (paidOverlaps.length > 0) {
        throw new BadRequestException({
          code: 'COMMISSIONS_PAID_OVERLAP',
          message:
            'Existem comissões pagas que se sobrepõem a este período. Exclua-as manualmente antes de regerar.',
          paidOverlaps: paidOverlaps.map((c: any) => ({
            id: c.id,
            periodStart: c.periodStart,
            periodEnd: c.periodEnd,
            professionalName: c.professional?.name || 'Profissional',
          })),
        });
      }

      // Apaga silenciosamente as PENDING sobrepostas — clicar "Gerar" de novo
      // deve sempre dar o resultado atualizado sem friction.
      const pendingIds = overlapping
        .filter((c: any) => c.status === 'PENDING')
        .map((c: any) => c.id);
      if (pendingIds.length > 0) {
        // ANTES de apagar, estornar as deduções de débito que essas comissões
        // fizeram — senão regerar o mesmo período dá valores diferentes a cada
        // clique (a comissão some, mas o débito deduzido fica DEDUCTED e a base
        // muda). Com o estorno, a geração volta a ser idempotente.
        await this.professionalDebtsService.reverseDeductionsForCommissions(pendingIds);
        await this.supabase.from('commissions').delete().in('id', pendingIds);
      }
    }

    // Cálculo das comissões do período (avulso×taxa + pote de assinatura + produtos×taxa).
    // Fonte ÚNICA da verdade — a mesma usada pelo Relatório por Profissional, para os
    // números baterem entre as duas telas.
    const breakdown = await this.computeCommissionBreakdownForPeriod(
      startStr,
      endStr,
      dto.subscriptionRevenueOverride,
    );

    if (breakdown.length === 0) {
      throw new BadRequestException(
        'Nenhum atendimento ou venda encontrado no período informado',
      );
    }

    const createdCommissions = [];

    for (const entry of breakdown) {
      const {
        professionalId,
        branchId,
        amountServices,
        amountSubscription,
        amountProducts,
        amount,
      } = entry;

      if (amount <= 0) continue;

      const d = new Date();
      const comNow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const { data: commission, error } = await this.supabase
        .from('commissions')
        .insert({
          id: randomUUID(),
          amount,
          amountServices,
          amountSubscription,
          amountProducts,
          amountDeductedDebts: 0,
          periodStart: startStr,
          periodEnd: endStr,
          status: 'PENDING',
          professionalId: professionalId,
          branchId: branchId,
          createdAt: comNow,
          updatedAt: comNow,
        })
        .select('*, professional:professionals(id, name, commissionRate)')
        .single();

      if (error || !commission) continue;

      // Aplica dedução de débitos pendentes do profissional.
      // Comissão nunca fica negativa: o que não couber permanece em
      // professional_debts como PENDING e é deduzido na próxima geração.
      try {
        const deducted = await this.professionalDebtsService.applyDeductionToCommission({
          professionalId,
          commissionId: commission.id,
          commissionAmount: amount,
        });

        if (deducted > 0) {
          await this.supabase
            .from('commissions')
            .update({ amountDeductedDebts: deducted, updatedAt: comNow })
            .eq('id', commission.id);
          commission.amountDeductedDebts = deducted;
        }
      } catch {
        // Falha na dedução não invalida a comissão; o débito segue PENDING.
      }

      createdCommissions.push(commission);
    }

    if (createdCommissions.length === 0) {
      throw new BadRequestException(
        'Nenhuma comissão gerada. Verifique se os profissionais possuem taxa de comissão configurada',
      );
    }

    return createdCommissions;
  }

  /**
   * Núcleo de cálculo das comissões de um período, SEM persistência nem dedução de
   * débitos. Fonte ÚNICA da verdade compartilhada por:
   *   - generate() — gera/persiste as comissões PENDING;
   *   - ReportsService.getProfessionalReport() — exibe a MESMA comissão no relatório
   *     por profissional, para os números baterem com a tela Comissões.
   *
   * Regra (em centavos): avulso × commissionRate + pote de assinatura (50% da receita
   * de assinatura dividido por fichas, independente do rate) + produtos × commissionRate.
   * Retorna um item por profissional com atendimento/venda no período (inclui amount 0).
   */
  async computeCommissionBreakdownForPeriod(
    startStr: string,
    endStr: string,
    subscriptionRevenueOverride?: number,
  ): Promise<
    Array<{
      professionalId: string;
      branchId: string | null;
      commissionRate: number;
      amountServices: number;
      amountSubscription: number;
      amountProducts: number;
      amount: number;
    }>
  > {
    // 1) Serviços avulsos (appointments sem assinatura). A comissão de serviço sai dos
    //    order_items SERVICE da comanda — NÃO de appointment.totalPrice. totalPrice mistura
    //    serviço + produto (orders.addItem faz appointment.totalPrice = order.totalAmount,
    //    somando QUALQUER item), então usá-lo aqui contava o produto 2× (uma no bucket de
    //    serviços via totalPrice e outra no bucket de produtos abaixo).
    const { data: regularAppointments } = await this.supabase
      .from('appointments')
      .select(
        'professionalId, totalPrice, orders(status, order_items(unitPrice, quantity, itemType, consumedSubscriptionCut))',
      )
      .eq('status', 'ATTENDED')
      .neq('usedSubscriptionCut', true)
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);

    // 2) Atendimentos do período (pela data do serviço). Inclui ATTENDED e também os
    //    PAGOS-mas-ainda-não-marcados-atendido (orders.pay marca isPaid sem virar
    //    ATTENDED): senão o PRODUTO de uma comanda paga desses sumiria da comissão
    //    (regressão do M3). usedSubscriptionCut + status separam os usos abaixo.
    const { data: attended } = await this.supabase
      .from('appointments')
      .select('id, usedSubscriptionCut, status')
      .or('status.eq.ATTENDED,isPaid.eq.true')
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);
    // PRODUTOS de comanda de agendamento: atribuídos a qualquer agendamento do período
    // que esteja ATTENDED ou pago (a venda do produto aconteceu).
    const attendedIds = (attended || []).map((a) => a.id);
    // Fichas/extras de assinatura: SÓ atendimento concluído (serviço de fato prestado).
    const subAppointmentIds = (attended || [])
      .filter((a) => a.status === 'ATTENDED' && a.usedSubscriptionCut)
      .map((a) => a.id);

    const CHUNK = 300;

    // 2.1) order_items dos atendimentos de assinatura. Separa o item COBERTO (consumiu
    //      corte → fichas do pote) do item EXTRA pago no mesmo atendimento (→ avulso ×
    //      taxa). Usa order_items, que tem consumedSubscriptionCut e o preço cobrado; o
    //      appointment_services não distinguia coberto de extra, contava ficha do extra e
    //      deixava o extra pago sem render comissão (M4). Em lotes (.in serializa na URL).
    const subOrders: any[] = [];
    for (let i = 0; i < subAppointmentIds.length; i += CHUNK) {
      const batch = subAppointmentIds.slice(i, i + CHUNK);
      const { data } = await this.supabase
        .from('orders')
        .select(
          'professionalId, items:order_items(unitPrice, quantity, itemType, consumedSubscriptionCut, service:services(fichas, duration))',
        )
        .in('appointmentId', batch);
      if (data) subOrders.push(...data);
    }

    // 3) Produtos: atribuídos pela data do TRABALHO, não da reserva (M3). Comanda de
    //    BALCÃO (sem agendamento) conta pela data de venda (createdAt); comanda de
    //    AGENDAMENTO conta pelo dia do atendimento (scheduledAt — via os ids de attended).
    //    Antes tudo ia por orders.createdAt (a data da RESERVA): um produto vendido numa
    //    comanda de agendamento futuro caía no período da reserva, não no do atendimento.
    const paidOrders: any[] = [];
    const { data: balcaoOrders } = await this.supabase
      .from('orders')
      .select('professionalId, items:order_items(unitPrice, quantity, itemType)')
      .eq('status', 'PAID')
      .is('appointmentId', null)
      .gte('createdAt', startStr)
      .lte('createdAt', endStr);
    if (balcaoOrders) paidOrders.push(...balcaoOrders);
    for (let i = 0; i < attendedIds.length; i += CHUNK) {
      const batch = attendedIds.slice(i, i + CHUNK);
      const { data } = await this.supabase
        .from('orders')
        .select('professionalId, items:order_items(unitPrice, quantity, itemType)')
        .eq('status', 'PAID')
        .in('appointmentId', batch);
      if (data) paidOrders.push(...data);
    }

    // Agrupar por profissional: { services, subscription, products }
    const grouped = new Map<
      string,
      { services: number; subscription: number; products: number }
    >();

    const getEntry = (profId: string) => {
      if (!grouped.has(profId)) {
        grouped.set(profId, { services: 0, subscription: 0, products: 0 });
      }
      return grouped.get(profId)!;
    };

    for (const appt of regularAppointments || []) {
      const orders = (appt as any).orders || [];
      let serviceTotal = 0;
      if (orders.length === 0) {
        // Agendamento legado (anterior à comanda automática, ~2026-04-01): não tem
        // order/order_items. Mantém o comportamento antigo via totalPrice — esses
        // atendimentos não têm produto na comanda, então não há dupla contagem.
        serviceTotal = (appt as any).totalPrice || 0;
      } else {
        for (const ord of orders) {
          if (ord.status === 'CANCELED') continue; // comanda cancelada não rende comissão
          for (const it of ord.order_items || []) {
            if (it.itemType !== 'SERVICE') continue; // produto entra no bucket de produtos
            if (it.consumedSubscriptionCut) continue; // coberto pelo plano não é avulso (defensivo)
            serviceTotal += (it.unitPrice || 0) * (it.quantity || 1);
          }
        }
      }
      getEntry((appt as any).professionalId).services += serviceTotal;
    }

    // Pote de fichas (item COBERTO) + extras pagos (item NÃO coberto → avulso × taxa).
    // Só o item que de fato consumiu corte gera ficha; o serviço extra cobrado no mesmo
    // atendimento rende a comissão normal de avulso (preço × taxa).
    const fichasByProfessional = new Map<string, number>();
    let totalFichas = 0;

    for (const order of subOrders) {
      const profId = (order as any).professionalId;
      if (!profId) continue;
      for (const item of (order as any).items || []) {
        if (item.itemType !== 'SERVICE') continue;
        if (item.consumedSubscriptionCut) {
          const fichas = item.service?.fichas || item.service?.duration || 0;
          fichasByProfessional.set(profId, (fichasByProfessional.get(profId) || 0) + fichas);
          totalFichas += fichas;
        } else if ((item.unitPrice || 0) > 0) {
          getEntry(profId).services += (item.unitPrice || 0) * (item.quantity || 1);
        }
      }
    }

    if (totalFichas > 0) {
      const totalSubscriptionValue =
        subscriptionRevenueOverride !== undefined
          ? subscriptionRevenueOverride
          : await this.computeSubscriptionRevenue(startStr, endStr);

      // 50% da receita fica com a barbearia, 50% vira pote dos barbeiros
      const barberPool = Math.round((totalSubscriptionValue * SUBSCRIPTION_BARBER_POOL_PERCENT) / 100);

      for (const [profId, profFichas] of fichasByProfessional) {
        const subscriptionShare = Math.round((profFichas / totalFichas) * barberPool);
        getEntry(profId).subscription += subscriptionShare;
      }
    }

    for (const order of paidOrders || []) {
      if (!order.professionalId) continue;
      const productTotal = ((order as any).items || [])
        .filter((item: any) => item.itemType === 'PRODUCT')
        .reduce((sum: number, item: any) => sum + item.unitPrice * (item.quantity || 1), 0);
      if (productTotal > 0) {
        getEntry(order.professionalId).products += productTotal;
      }
    }

    const breakdown: Array<{
      professionalId: string;
      branchId: string | null;
      commissionRate: number;
      amountServices: number;
      amountSubscription: number;
      amountProducts: number;
      amount: number;
    }> = [];

    for (const [professionalId, totals] of grouped) {
      const { data: professional } = await this.supabase
        .from('professionals')
        .select('id, commissionRate, branchId')
        .eq('id', professionalId)
        .single();

      if (!professional) continue;

      // commissionRate aplica em cortes avulsos e produtos. Assinatura é pote fixo
      // (50% da receita dividido por fichas), independente do rate do barbeiro.
      const rate = professional.commissionRate || 0;
      const amountServices = Math.round((totals.services * rate) / 100);
      const amountSubscription = totals.subscription;
      const amountProducts = Math.round((totals.products * rate) / 100);
      const amount = amountServices + amountSubscription + amountProducts;

      breakdown.push({
        professionalId,
        branchId: professional.branchId ?? null,
        commissionRate: rate,
        amountServices,
        amountSubscription,
        amountProducts,
        amount,
      });
    }

    return breakdown;
  }

  async getPoteReport(
    periodStart: string,
    periodEnd: string,
    revenueOverride?: number,
  ) {
    const startStr = `${periodStart}T00:00:00`;
    const endStr = `${periodEnd}T23:59:59`;

    // Buscar atendimentos de assinatura no período
    const { data: subscriptionAppointments } = await this.supabase
      .from('appointments')
      .select('professionalId, services:appointment_services(service:services(id, name, fichas, duration))')
      .eq('status', 'ATTENDED')
      .eq('usedSubscriptionCut', true)
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);

    // Contagem de assinaturas ativas no período (apenas para exibição)
    const { data: activeSubscriptions } = await this.supabase
      .from('client_subscriptions')
      .select('id')
      .in('status', ['ACTIVE', 'SUSPENDED'])
      .lte('startDate', endStr)
      .gte('endDate', startStr);

    // Faturamento real = soma de pagamentos de assinatura no período
    const autoSubscriptionValue = await this.computeSubscriptionRevenue(
      startStr,
      endStr,
    );

    // Se houver override do usuário, ele tem precedência sobre o auto-cálculo
    const totalSubscriptionValue =
      revenueOverride !== undefined && revenueOverride >= 0
        ? revenueOverride
        : autoSubscriptionValue;

    // Agrupar fichas por profissional e por serviço
    const profMap = new Map<string, { fichas: number; services: Map<string, { name: string; count: number; fichas: number }> }>();
    let totalFichas = 0;
    let totalServices = 0;

    for (const appt of subscriptionAppointments || []) {
      if (!profMap.has(appt.professionalId)) {
        profMap.set(appt.professionalId, { fichas: 0, services: new Map() });
      }
      const prof = profMap.get(appt.professionalId)!;

      for (const as_ of (appt as any).services || []) {
        const svc = as_.service;
        if (!svc) continue;
        const svcFichas = svc.fichas || svc.duration || 0;
        prof.fichas += svcFichas;
        totalFichas += svcFichas;
        totalServices++;

        if (!prof.services.has(svc.id)) {
          prof.services.set(svc.id, { name: svc.name, count: 0, fichas: 0 });
        }
        const svcEntry = prof.services.get(svc.id)!;
        svcEntry.count++;
        svcEntry.fichas += svcFichas;
      }
    }

    // Buscar nomes dos profissionais
    const profIds = Array.from(profMap.keys());
    const professionals: { id: string; name: string; commissionRate: number }[] = [];
    for (const profId of profIds) {
      const { data: prof } = await this.supabase
        .from('professionals')
        .select('id, name, commissionRate')
        .eq('id', profId)
        .single();
      if (prof) professionals.push(prof);
    }

    // Montar resultado por profissional.
    // shareOfPot = fatia da receita TOTAL trazida pelo profissional (referência).
    // commission = o que ele de fato recebe = 50% do shareOfPot (regra fixa).
    // Os outros 50% ficam com a barbearia (calculado no front como shareOfPot - commission).
    const byProfessional = professionals.map((prof) => {
      const entry = profMap.get(prof.id)!;
      const percentage = totalFichas > 0 ? entry.fichas / totalFichas : 0;
      const shareOfPot = Math.round(percentage * totalSubscriptionValue);
      const commission = Math.round((shareOfPot * SUBSCRIPTION_BARBER_POOL_PERCENT) / 100);

      return {
        professionalId: prof.id,
        professionalName: prof.name,
        commissionRate: prof.commissionRate,
        fichas: entry.fichas,
        percentage: Math.round(percentage * 10000) / 100,
        shareOfPot,
        commission,
        services: Array.from(entry.services.values()),
      };
    }).sort((a, b) => b.fichas - a.fichas);

    return {
      periodStart,
      periodEnd,
      totalServices,
      totalFichas,
      totalSubscriptionValue,
      autoSubscriptionValue,
      isOverridden:
        revenueOverride !== undefined && revenueOverride !== autoSubscriptionValue,
      barberPoolPercent: SUBSCRIPTION_BARBER_POOL_PERCENT,
      activeSubscriptions: activeSubscriptions?.length || 0,
      byProfessional,
    };
  }

  /**
   * Faturamento das assinaturas no período = SOMENTE pagamentos reais de
   * assinatura (payments com subscriptionId e paidAt no período).
   *
   * Envolve dinheiro (vira o "pote" dividido entre barbeiros), então NÃO usamos
   * estimativa: nada de fallback por plan.price das assinaturas ativas. O fallback
   * antigo dependia do status ATUAL da assinatura (ACTIVE/SUSPENDED), que os crons
   * mudam ao longo do tempo (ACTIVE→SUSPENDED→CANCELED) — isso fazia o pote encolher
   * sozinho entre gerações. Agora o valor é determinístico: reflete o que de fato
   * entrou. Se não houver pagamento registrado, o pote é 0 e o admin pode informar
   * manualmente pelo campo de override (subscriptionRevenueOverride).
   */
  private async computeSubscriptionRevenue(
    startStr: string,
    endStr: string,
  ): Promise<number> {
    const { data: paidPayments } = await this.supabase
      .from('payments')
      .select('amount, asaasStatus')
      .not('subscriptionId', 'is', null)
      .gte('paidAt', startStr)
      .lte('paidAt', endStr);

    // Exclui assinatura estornada/cancelada: dinheiro devolvido não pode inflar o
    // pote dividido entre os barbeiros.
    return (paidPayments || [])
      .filter(isRevenuePayment)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  }

  async findAll(query: QueryCommissionDto) {
    let queryBuilder = this.supabase
      .from('commissions')
      .select('*, professional:professionals(id, name, commissionRate)');

    if (query.professionalId) {
      queryBuilder = queryBuilder.eq('professionalId', query.professionalId);
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('periodStart', `${query.startDate}T00:00:00`);
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('periodStart', `${query.endDate}T23:59:59`);
    }

    const { data: commissions, error } = await queryBuilder.order('createdAt', { ascending: false });

    if (error) throw error;
    return commissions || [];
  }

  async findOne(id: string) {
    const { data: commission, error } = await this.supabase
      .from('commissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    return commission;
  }

  async markAsPaid(id: string) {
    const { data: commission, error } = await this.supabase
      .from('commissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    if (commission.status === 'PAID') {
      throw new BadRequestException('Esta comissão já foi paga');
    }

    const d = new Date();
    const paidNow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const { data: updated, error: updateError } = await this.supabase
      .from('commissions')
      .update({ status: 'PAID', paidAt: paidNow })
      .eq('id', id)
      .select('*, professional:professionals(id, name, commissionRate)')
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async remove(id: string) {
    const { data: commission, error: findError } = await this.supabase
      .from('commissions')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    const { error } = await this.supabase.from('commissions').delete().eq('id', id);

    if (error) throw error;
  }
}
