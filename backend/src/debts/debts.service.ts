import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDebtDto, UpdateDebtDto, PayDebtDto } from './dto';

@Injectable()
export class DebtsService {
  constructor(private readonly supabase: SupabaseService) {}

  async createDebt(dto: CreateDebtDto) {
    // 1. Verificar se cliente existe
    const { data: client, error: clientError } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', dto.clientId)
      .single();

    if (clientError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 2. Criar dívida
    const { data: debt, error } = await this.supabase
      .from('debts')
      .insert({
        client_id: dto.clientId,
        appointment_id: dto.appointmentId,
        amount: dto.amount,
        amount_paid: 0,
        remaining_balance: dto.amount,
        description: dto.description,
        due_date: dto.dueDate,
        is_settled: false,
      })
      .select('*')
      .single();

    if (error) throw error;

    // 3. Atualizar flag hasDebts do cliente
    await this.supabase
      .from('clients')
      .update({ has_debts: true })
      .eq('id', dto.clientId);

    return debt;
  }

  async registerPartialPayment(debtId: string, dto: PayDebtDto) {
    const { data: debt, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .single();

    if (error || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.is_settled) {
      throw new BadRequestException('Esta dívida já está quitada');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }

    if (dto.amount > debt.remaining_balance) {
      throw new BadRequestException(
        `Valor excede o saldo devedor. Máximo: ${debt.remaining_balance} centavos`,
      );
    }

    const newAmountPaid = debt.amount_paid + dto.amount;
    const newRemainingBalance = debt.remaining_balance - dto.amount;
    const isNowSettled = newRemainingBalance === 0;

    const { data: updatedDebt, error: updateError } = await this.supabase
      .from('debts')
      .update({
        amount_paid: newAmountPaid,
        remaining_balance: newRemainingBalance,
        is_settled: isNowSettled,
        paid_at: isNowSettled ? new Date().toISOString() : null,
      })
      .eq('id', debtId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // Se quitou, verificar se cliente ainda tem outras dívidas
    if (isNowSettled) {
      await this.updateClientHasDebtsFlag(debt.client_id);
    }

    return updatedDebt;
  }

  async settleDebt(id: string) {
    const { data: debt, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.is_settled) {
      throw new BadRequestException('Esta dívida já está quitada');
    }

    const { data: updatedDebt, error: updateError } = await this.supabase
      .from('debts')
      .update({
        is_settled: true,
        paid_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    await this.updateClientHasDebtsFlag(debt.client_id);

    return updatedDebt;
  }

  async findOne(id: string) {
    const { data: debt, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    return debt;
  }

  async findAll() {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findOutstanding() {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('is_settled', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findByClient(clientId: string) {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findOutstandingByClient(clientId: string) {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_settled', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async calculateClientTotalDebt(clientId: string): Promise<number> {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('remaining_balance')
      .eq('client_id', clientId)
      .eq('is_settled', false);

    if (error) throw error;

    return (debts || []).reduce((sum, d) => sum + d.remaining_balance, 0);
  }

  async update(id: string, dto: UpdateDebtDto) {
    const { data: debt, error: findError } = await this.supabase
      .from('debts')
      .select('id, is_settled')
      .eq('id', id)
      .single();

    if (findError || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.is_settled) {
      throw new BadRequestException('Não é possível editar uma dívida quitada');
    }

    const { data: updated, error } = await this.supabase
      .from('debts')
      .update({
        description: dto.description,
        due_date: dto.dueDate,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string): Promise<void> {
    const { data: debt, error: findError } = await this.supabase
      .from('debts')
      .select('id, client_id')
      .eq('id', id)
      .single();

    if (findError || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    const { error } = await this.supabase.from('debts').delete().eq('id', id);

    if (error) throw error;

    await this.updateClientHasDebtsFlag(debt.client_id);
  }

  private async updateClientHasDebtsFlag(clientId: string): Promise<void> {
    const { count } = await this.supabase
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_settled', false);

    await this.supabase
      .from('clients')
      .update({ has_debts: (count || 0) > 0 })
      .eq('id', clientId);
  }
}
