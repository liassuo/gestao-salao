import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { OpenCashRegisterDto, CloseCashRegisterDto } from './dto';

@Injectable()
export class CashRegisterService {
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
      .single();

    if (existingRegister) {
      throw new ConflictException('Já existe um caixa para este dia');
    }

    const { data: openRegister } = await this.supabase
      .from('cash_registers')
      .select('id')
      .eq('isOpen', true)
      .single();

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

  async getTodayRegister() {
    const todayStr = this.getLocalDateStr();
    const startOfDay = `${todayStr}T00:00:00`;
    const endOfDay = `${todayStr}T23:59:59`;

    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .single();

    // Se o caixa está aberto, calcular totais em tempo real
    if (register && register.isOpen) {
      const totals = await this.calculateDailyTotals(register.date);
      register.totalCash = totals.cash;
      register.totalPix = totals.pix;
      register.totalCard = totals.card;
      register.totalRevenue = totals.total;
    }

    return register;
  }

  async findOpen() {
    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('isOpen', true)
      .single();

    // Calcular totais em tempo real para o caixa aberto
    if (register) {
      const totals = await this.calculateDailyTotals(register.date);
      register.totalCash = totals.cash;
      register.totalPix = totals.pix;
      register.totalCard = totals.card;
      register.totalRevenue = totals.total;
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
    return registers || [];
  }

  async calculateDailyTotals(dateInput: Date | string) {
    let dateStr: string;
    if (typeof dateInput === 'string') {
      dateStr = dateInput.substring(0, 10);
    } else {
      dateStr = this.getLocalDateStr(dateInput);
    }
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;

    const { data: payments } = await this.supabase
      .from('payments')
      .select('amount, method, asaasStatus')
      .gte('paidAt', startOfDay)
      .lte('paidAt', endOfDay);

    const totals = { cash: 0, pix: 0, card: 0, boleto: 0, total: 0 };

    for (const payment of payments || []) {
      // Ignorar pagamentos Asaas que foram estornados ou deletados
      if (payment.asaasStatus && ['REFUNDED', 'DELETED', 'CANCELED'].includes(payment.asaasStatus)) {
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
    }

    return totals;
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
}
