import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { isRevenuePayment } from '../common/business-date.helper';
import { OpenCashRegisterDto, CloseCashRegisterDto } from './dto';

/** Discrepância (em centavos) que dispara aviso WARN ao fechar caixa. */
const DISCREPANCY_WARN_THRESHOLD = 5000; // R$ 50,00

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger(CashRegisterService.name);
  constructor(private readonly supabase: SupabaseService) {}

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /** Retorna data local no formato YYYY-MM-DD */
  private getLocalDateStr(date: Date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Dia seguinte (YYYY-MM-DD) a partir de uma string YYYY-MM-DD, com rollover de mês/ano. */
  private nextDayStr(dayStr: string): string {
    const [y, m, d] = dayStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    return this.getLocalDateStr(dt);
  }

  /** Retorna datetime local no formato YYYY-MM-DDTHH:mm:ss (sem Z, evita problemas de fuso) */
  private getLocalDateTimeStr(date: Date = new Date()): string {
    return `${this.getLocalDateStr(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  }

  async openRegister(dto: OpenCashRegisterDto) {
    let openedBy = dto.openedBy;

    if (!openedBy) {
      // Buscar primeiro admin disponível
      const { data: admin } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .limit(1)
        .single();

      if (!admin) {
        throw new NotFoundException('Nenhum administrador encontrado');
      }
      openedBy = admin.id;
    } else {
      const { data: user } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', openedBy)
        .single();

      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }
    }

    const dateStr = this.getLocalDateStr(dto.date ?? new Date());
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;

    const { data: existingRegister } = await this.supabase
      .from('cash_registers')
      .select('id')
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .maybeSingle();

    if (existingRegister) {
      throw new ConflictException('Já existe um caixa para este dia');
    }

    const { data: openRegister } = await this.supabase
      .from('cash_registers')
      .select('id')
      .eq('isOpen', true)
      .maybeSingle();

    if (openRegister) {
      throw new BadRequestException('Existe um caixa aberto que precisa ser fechado primeiro');
    }

    const now = this.getLocalDateTimeStr();
    const { data: register, error } = await this.supabase
      .from('cash_registers')
      .insert({
        id: randomUUID(),
        date: `${dateStr}T00:00:00`,
        openedAt: now,
        openingBalance: dto.openingBalance,
        openedBy: openedBy,
        isOpen: true,
        notes: dto.notes,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;
    return register;
  }

  async closeRegister(id: string, dto: CloseCashRegisterDto) {
    const { data: register, error } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !register) {
      throw new NotFoundException('Caixa não encontrado');
    }

    if (!register.isOpen) {
      throw new BadRequestException('Este caixa já está fechado');
    }

    // Usar closedBy do DTO ou fallback para openedBy do registro
    const closedBy = dto.closedBy || register.openedBy;

    const totals = await this.calculateDailyTotals(register.date);
    const expectedClosingBalance = register.openingBalance + totals.cash;
    const discrepancy = dto.closingBalance - expectedClosingBalance;

    if (Math.abs(discrepancy) >= DISCREPANCY_WARN_THRESHOLD) {
      this.logger.warn(
        `Caixa ${id} fechado com discrepância de ${(discrepancy / 100).toFixed(2)} ` +
          `(esperado ${(expectedClosingBalance / 100).toFixed(2)}, ` +
          `informado ${(dto.closingBalance / 100).toFixed(2)}, ` +
          `cash do dia ${(totals.cash / 100).toFixed(2)}). ` +
          `Notas: ${dto.notes ?? '(nenhuma)'}`,
      );
    }

    const { data: closedRegister, error: closeError } = await this.supabase
      .from('cash_registers')
      .update({
        closedAt: this.getLocalDateTimeStr(),
        closedBy,
        closingBalance: dto.closingBalance,
        totalCash: totals.cash,
        totalPix: totals.pix,
        totalCard: totals.card,
        totalRevenue: totals.total,
        discrepancy,
        isOpen: false,
        notes: dto.notes ? `${register.notes ?? ''}\n${dto.notes}`.trim() : register.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (closeError) throw closeError;
    return closedRegister;
  }

  /**
   * Reabre um caixa fechado. Mantém openingBalance e openedAt originais —
   * limpa apenas os campos de fechamento (closedAt, closingBalance, totalCash/Pix/
   * Card/Revenue, discrepancy) para que ao fechar de novo recalcule do zero.
   * Bloqueia se ja houver outro caixa aberto (regra unique enforced no openRegister).
   */
  async reopenRegister(id: string) {
    const { data: register, error } = await this.supabase
      .from('cash_registers')
      .select('id, isOpen')
      .eq('id', id)
      .single();

    if (error || !register) {
      throw new NotFoundException('Caixa não encontrado');
    }

    if (register.isOpen) {
      throw new BadRequestException('Este caixa já está aberto');
    }

    const { data: alreadyOpen } = await this.supabase
      .from('cash_registers')
      .select('id')
      .eq('isOpen', true)
      .maybeSingle();

    if (alreadyOpen) {
      throw new BadRequestException(
        'Já existe um caixa aberto. Feche-o antes de reabrir este.',
      );
    }

    const { data: reopened, error: updateError } = await this.supabase
      .from('cash_registers')
      .update({
        isOpen: true,
        closedAt: null,
        closedBy: null,
        closingBalance: null,
        totalCash: null,
        totalPix: null,
        totalCard: null,
        totalRevenue: null,
        discrepancy: null,
        updatedAt: this.getLocalDateTimeStr(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return reopened;
  }

  async getTodayRegister() {
    const todayStr = this.getLocalDateStr();
    const startOfDay = `${todayStr}T00:00:00`;
    const endOfDay = `${todayStr}T23:59:59`;

    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .maybeSingle();

    // Se o caixa está aberto, calcular totais em tempo real
    if (register && register.isOpen) {
      const totals = await this.calculateDailyTotals(register.date);
      register.totalCash = totals.cash;
      register.totalPix = totals.pix;
      register.totalCard = totals.card;
      register.totalRevenue = totals.total;
      register.totalSubscriptions = totals.subscriptions;
    } else if (register) {
      // Caixa já fechado: recomputa a faixa de assinaturas (não persiste em coluna)
      const totals = await this.calculateDailyTotals(register.date);
      register.totalSubscriptions = totals.subscriptions;
    }

    return register;
  }

  async findOpen() {
    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('isOpen', true)
      .maybeSingle();

    // Calcular totais em tempo real para o caixa aberto
    if (register) {
      const totals = await this.calculateDailyTotals(register.date);
      register.totalCash = totals.cash;
      register.totalPix = totals.pix;
      register.totalCard = totals.card;
      register.totalRevenue = totals.total;
      register.totalSubscriptions = totals.subscriptions;
    }

    return register;
  }

  async findOne(id: string) {
    const { data: register, error } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !register) {
      throw new NotFoundException('Caixa não encontrado');
    }

    // Faturamento por assinaturas não tem coluna persistida — recomputa a partir dos payments do dia.
    const totals = await this.calculateDailyTotals(register.date);
    register.totalSubscriptions = totals.subscriptions;

    return register;
  }

  async findByDate(date: Date) {
    const dateStr = this.getLocalDateStr(date);
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;

    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .single();

    return register;
  }

  async findAll() {
    const { data: registers, error } = await this.supabase
      .from('cash_registers')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    const list = registers || [];
    // Anexa faturamento por assinaturas em cada caixa (recomputa por dia — sem coluna persistida).
    for (const r of list) {
      try {
        const totals = await this.calculateDailyTotals(r.date);
        (r as any).totalSubscriptions = totals.subscriptions;
      } catch {
        (r as any).totalSubscriptions = 0;
      }
    }
    return list;
  }

  async calculateDailyTotals(dateInput: Date | string) {
    let dateStr: string;
    if (typeof dateInput === 'string') {
      dateStr = dateInput.substring(0, 10);
    } else {
      dateStr = this.getLocalDateStr(dateInput);
    }
    const startOfDay = `${dateStr}T00:00:00`;
    // Limite superior EXCLUSIVO no início do dia seguinte. Usar .lt(nextDay) em vez
    // de .lte('...T23:59:59') evita perder um pagamento gravado com milissegundos
    // (ex.: '...T23:59:59.123' > '...T23:59:59' lexicograficamente sairia da janela).
    const nextDayStart = `${this.nextDayStr(dateStr)}T00:00:00`;

    // O caixa contabiliza pelo DIA CONTÁBIL (businessDate): dia do atendimento
    // quando há agendamento; senão dia do pagamento. Como o Postgres/Supabase não
    // expõe coalesce direto no filtro, fazemos coalesce(businessDate, paidAt) em
    // duas queries:
    //   (a) pagamentos cujo businessDate cai no dia (regra nova);
    //   (b) LEGADO: businessDate nulo e paidAt no dia (histórico, conta como antes).
    // Cobranças Asaas pendentes têm paidAt e businessDate nulos → não entram em
    // nenhuma das duas (só contam quando o webhook confirma e preenche os campos).
    const { data: byBusiness, error: bErr } = await this.supabase
      .from('payments')
      .select('amount, method, asaasStatus, subscriptionId')
      .gte('businessDate', startOfDay)
      .lt('businessDate', nextDayStart);

    const { data: byPaidLegacy, error: pErr } = await this.supabase
      .from('payments')
      .select('amount, method, asaasStatus, subscriptionId')
      .is('businessDate', null)
      .gte('paidAt', startOfDay)
      .lt('paidAt', nextDayStart);

    const paymentsError = bErr || pErr;
    // Falha ruidosamente: caixa zerado por erro silencioso de query é bug crítico.
    if (paymentsError) {
      throw new Error(
        `Falha ao calcular totais do caixa para ${dateStr}: ${paymentsError.message} (code=${paymentsError.code})`,
      );
    }

    const payments = [...(byBusiness || []), ...(byPaidLegacy || [])];
    const totals = { cash: 0, pix: 0, card: 0, boleto: 0, total: 0, subscriptions: 0 };

    for (const payment of payments) {
      // Ignorar pagamentos Asaas que saíram da receita (estorno/cancelamento/chargeback).
      if (!isRevenuePayment(payment)) {
        continue;
      }

      switch (payment.method) {
        case 'CASH':
          totals.cash += payment.amount;
          break;
        case 'PIX':
          totals.pix += payment.amount;
          break;
        case 'CARD':
          totals.card += payment.amount;
          break;
        case 'BOLETO':
          totals.boleto += payment.amount;
          break;
      }
      totals.total += payment.amount;
      // Faturamento vindo de assinaturas (mensalidade do plano) — categoria
      // transversal a método de pagamento. O caixa mostra como linha separada
      // para o admin conferir quanto do dia veio de plano vs avulso.
      if (payment.subscriptionId) {
        totals.subscriptions += payment.amount;
      }
    }

    return totals;
  }

  /**
   * Relação detalhada dos atendimentos/pagamentos que compõem a receita de um dia
   * (pelo DIA CONTÁBIL — businessDate, com fallback paidAt). Para cada pagamento
   * traz cliente, profissional (via comanda) e os itens/serviços, para o admin
   * conferir a soma do caixa linha a linha.
   *
   * Ignora pagamentos estornados/cancelados/deletados do Asaas (não entram no caixa).
   */
  async getDailyTransactions(dateInput: Date | string) {
    const dateStr =
      typeof dateInput === 'string'
        ? dateInput.substring(0, 10)
        : this.getLocalDateStr(dateInput);
    const startOfDay = `${dateStr}T00:00:00`;
    const nextDayStart = `${this.nextDayStr(dateStr)}T00:00:00`;

    // Pagamentos do dia contábil (regra nova) + legado (businessDate nulo, por paidAt).
    const sel =
      'id, amount, method, paidAt, businessDate, asaasStatus, subscriptionId, clientId, appointmentId';
    const { data: byBusiness, error: bErr } = await this.supabase
      .from('payments')
      .select(sel)
      .gte('businessDate', startOfDay)
      .lt('businessDate', nextDayStart);
    const { data: byPaidLegacy, error: pErr } = await this.supabase
      .from('payments')
      .select(sel)
      .is('businessDate', null)
      .gte('paidAt', startOfDay)
      .lt('paidAt', nextDayStart);

    if (bErr || pErr) {
      throw new Error(
        `Falha ao listar atendimentos do caixa para ${dateStr}: ${(bErr || pErr)!.message}`,
      );
    }

    const payments = [...(byBusiness || []), ...(byPaidLegacy || [])].filter(
      isRevenuePayment,
    );

    // Enriquecimento: cliente, profissional (via order) e itens da comanda.
    const transactions = [];
    for (const p of payments) {
      // Cliente
      let clientName: string | null = null;
      if (p.clientId) {
        const { data: client } = await this.supabase
          .from('clients')
          .select('name')
          .eq('id', p.clientId)
          .maybeSingle();
        clientName = (client as any)?.name ?? null;
      }

      // Comanda vinculada a este pagamento (para profissional + itens)
      const { data: order } = await this.supabase
        .from('orders')
        .select(
          'id, professionalId, items:order_items(itemType, quantity, unitPrice, service:services(name), product:products(name))',
        )
        .eq('paymentId', p.id)
        .maybeSingle();

      let professionalName: string | null = null;
      const profId = (order as any)?.professionalId;
      if (profId) {
        const { data: prof } = await this.supabase
          .from('professionals')
          .select('name')
          .eq('id', profId)
          .maybeSingle();
        professionalName = (prof as any)?.name ?? null;
      }

      const items = ((order as any)?.items || []).map((it: any) => ({
        name: it.service?.name ?? it.product?.name ?? '—',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));

      transactions.push({
        id: p.id,
        paidAt: p.paidAt,
        businessDate: p.businessDate,
        amount: p.amount,
        method: p.method,
        clientName,
        professionalName,
        isSubscription: !!p.subscriptionId,
        items,
      });
    }

    // Ordena por horário do pagamento
    transactions.sort((a, b) =>
      String(a.paidAt ?? '').localeCompare(String(b.paidAt ?? '')),
    );

    const total = transactions.reduce((s, t) => s + t.amount, 0);
    return { date: dateStr, count: transactions.length, total, transactions };
  }

  async getSummary(startDate: Date, endDate: Date) {
    const startStr = `${this.getLocalDateStr(startDate)}T00:00:00`;
    const endStr = `${this.getLocalDateStr(endDate)}T23:59:59`;

    const { data: registers } = await this.supabase
      .from('cash_registers')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
      .eq('isOpen', false);

    const summary = {
      totalRevenue: 0,
      totalCash: 0,
      totalPix: 0,
      totalCard: 0,
      totalDiscrepancy: 0,
      daysCount: (registers || []).length,
    };

    for (const register of registers || []) {
      summary.totalRevenue += register.totalRevenue ?? 0;
      summary.totalCash += register.totalCash ?? 0;
      summary.totalPix += register.totalPix ?? 0;
      summary.totalCard += register.totalCard ?? 0;
      summary.totalDiscrepancy += register.discrepancy ?? 0;
    }

    return summary;
  }

  async linkPaymentToRegister(paymentId: string) {
    const todayRegister = await this.getTodayRegister();

    if (todayRegister && todayRegister.isOpen) {
      await this.supabase
        .from('payments')
        .update({ cashRegisterId: todayRegister.id })
        .eq('id', paymentId);
    }
  }

  /**
   * Vincula um pagamento ao caixa do DIA CONTÁBIL (businessDate) — dia do
   * atendimento quando há agendamento, e que pode não ser o caixa aberto agora
   * (ex.: atendimento de ontem pago de madrugada). Se o caixa daquele dia já
   * estiver FECHADO, recalcula e persiste seus totais para refletir o pagamento
   * atrasado (a receita de um dia passado muda — acordado com o cliente).
   *
   * Centraliza a regra para os fluxos de pagamento (comanda manual, comanda
   * Asaas via webhook, pagamento avulso) chamarem o mesmo ponto.
   */
  async linkPaymentToBusinessDateRegister(paymentId: string, businessDate: string) {
    const dayStr = businessDate.substring(0, 10); // YYYY-MM-DD
    // cash_registers.date é tipo `date` no banco (serializa "YYYY-MM-DD"), mas o
    // app grava/compara como "YYYY-MM-DDT00:00:00". A janela [dayStr, nextDay)
    // casa AMBOS os formatos: ">= '2026-05-07'" pega tanto "2026-05-07" quanto
    // "2026-05-07T00:00:00", e "< '2026-05-08'" exclui o dia seguinte. (Comparar
    // por "T00:00:00".."T23:59:59" falharia: a data pura de 10 chars ordena ANTES
    // de "...T00:00:00" lexicograficamente.)
    const nextDay = this.nextDayStr(dayStr);
    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('id, isOpen')
      .gte('date', dayStr)
      .lt('date', nextDay)
      .maybeSingle();

    if (!register) return;

    await this.supabase
      .from('payments')
      .update({ cashRegisterId: register.id })
      .eq('id', paymentId);

    if (register.isOpen === false) {
      await this.recalcRegisterTotals(register.id);
    }
  }

  /**
   * Recalcula e persiste os totais de um caixa (normalmente já fechado) somando
   * os pagamentos cujo dia contábil cai no dia do caixa. Usa
   * coalesce(businessDate, paidAt): pagamentos legados (businessDate nulo)
   * continuam contando pela data de pagamento.
   */
  async recalcRegisterTotals(registerId: string) {
    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('id, date, openingBalance, closingBalance')
      .eq('id', registerId)
      .single();
    if (!register) return;

    const totals = await this.calculateDailyTotals(register.date);
    const expectedClosing = (register.openingBalance ?? 0) + totals.cash;
    const discrepancy = (register.closingBalance ?? 0) - expectedClosing;

    await this.supabase
      .from('cash_registers')
      .update({
        totalCash: totals.cash,
        totalPix: totals.pix,
        totalCard: totals.card,
        totalRevenue: totals.total,
        discrepancy,
      })
      .eq('id', register.id);
  }
}
