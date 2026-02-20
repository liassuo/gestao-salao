import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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

  async openRegister(dto: OpenCashRegisterDto) {
    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', dto.openedBy)
      .single();

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const normalizedDate = this.normalizeDate(dto.date ?? new Date());

    const { data: existingRegister } = await this.supabase
      .from('cash_registers')
      .select('id')
      .eq('date', normalizedDate.toISOString())
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

    const { data: register, error } = await this.supabase
      .from('cash_registers')
      .insert({
        date: normalizedDate.toISOString(),
        openedAt: new Date().toISOString(),
        openingBalance: dto.openingBalance,
        openedBy: dto.openedBy,
        isOpen: true,
        notes: dto.notes,
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

    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', dto.closedBy)
      .single();

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const totals = await this.calculateDailyTotals(new Date(register.date));
    const expectedClosingBalance = register.openingBalance + totals.cash;
    const discrepancy = dto.closingBalance - expectedClosingBalance;

    const { data: closedRegister, error: closeError } = await this.supabase
      .from('cash_registers')
      .update({
        closedAt: new Date().toISOString(),
        closedBy: dto.closedBy,
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
    const today = this.normalizeDate(new Date());

    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('date', today.toISOString())
      .single();

    return register;
  }

  async findOpen() {
    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('isOpen', true)
      .single();

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
    const normalizedDate = this.normalizeDate(date);

    const { data: register } = await this.supabase
      .from('cash_registers')
      .select('*')
      .eq('date', normalizedDate.toISOString())
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

  async calculateDailyTotals(date: Date) {
    const normalizedDate = this.normalizeDate(date);
    const nextDay = new Date(normalizedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const { data: payments } = await this.supabase
      .from('payments')
      .select('amount, method')
      .gte('paidAt', normalizedDate.toISOString())
      .lt('paidAt', nextDay.toISOString());

    const totals = { cash: 0, pix: 0, card: 0, total: 0 };

    for (const payment of payments || []) {
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
      }
      totals.total += payment.amount;
    }

    return totals;
  }

  async getSummary(startDate: Date, endDate: Date) {
    const { data: registers } = await this.supabase
      .from('cash_registers')
      .select('*')
      .gte('date', this.normalizeDate(startDate).toISOString())
      .lte('date', this.normalizeDate(endDate).toISOString())
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
