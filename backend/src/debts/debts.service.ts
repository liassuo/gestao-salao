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
        clientId: dto.clientId,
        appointmentId: dto.appointmentId,
        amount: dto.amount,
        amountPaid: 0,
        remainingBalance: dto.amount,
        description: dto.description,
        dueDate: dto.dueDate,
        isSettled: false,
      })
      .select('*')
      .single();

    if (error) throw error;

    // 3. Atualizar flag hasDebts do cliente
    await this.supabase
      .from('clients')
      .update({ hasDebts: true })
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

    if (debt.isSettled) {
      throw new BadRequestException('Esta dívida já está quitada');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }

    if (dto.amount > debt.remainingBalance) {
      throw new BadRequestException(
        `Valor excede o saldo devedor. Máximo: ${debt.remainingBalance} centavos`,
      );
    }

    const newAmountPaid = debt.amountPaid + dto.amount;
    const newRemainingBalance = debt.remainingBalance - dto.amount;
    const isNowSettled = newRemainingBalance === 0;

    const { data: updatedDebt, error: updateError } = await this.supabase
      .from('debts')
      .update({
        amountPaid: newAmountPaid,
        remainingBalance: newRemainingBalance,
        isSettled: isNowSettled,
        paidAt: isNowSettled ? new Date().toISOString() : null,
      })
      .eq('id', debtId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // Se quitou, verificar se cliente ainda tem outras dívidas
    if (isNowSettled) {
      await this.updateClientHasDebtsFlag(debt.clientId);
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

    if (debt.isSettled) {
      throw new BadRequestException('Esta dívida já está quitada');
    }

    const { data: updatedDebt, error: updateError } = await this.supabase
      .from('debts')
      .update({
        isSettled: true,
        paidAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    await this.updateClientHasDebtsFlag(debt.clientId);

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
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findOutstanding() {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('isSettled', false)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findByClient(clientId: string) {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('clientId', clientId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findOutstandingByClient(clientId: string) {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('*')
      .eq('clientId', clientId)
      .eq('isSettled', false)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async calculateClientTotalDebt(clientId: string): Promise<number> {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('remainingBalance')
      .eq('clientId', clientId)
      .eq('isSettled', false);

    if (error) throw error;

    return (debts || []).reduce((sum, d) => sum + d.remainingBalance, 0);
  }

  async update(id: string, dto: UpdateDebtDto) {
    const { data: debt, error: findError } = await this.supabase
      .from('debts')
      .select('id, isSettled')
      .eq('id', id)
      .single();

    if (findError || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.isSettled) {
      throw new BadRequestException('Não é possível editar uma dívida quitada');
    }

    const { data: updated, error } = await this.supabase
      .from('debts')
      .update({
        description: dto.description,
        dueDate: dto.dueDate,
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
      .select('id, clientId')
      .eq('id', id)
      .single();

    if (findError || !debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    const { error } = await this.supabase.from('debts').delete().eq('id', id);

    if (error) throw error;

    await this.updateClientHasDebtsFlag(debt.clientId);
  }

  private async updateClientHasDebtsFlag(clientId: string): Promise<void> {
    const { count } = await this.supabase
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('clientId', clientId)
      .eq('isSettled', false);

    await this.supabase
      .from('clients')
      .update({ hasDebts: (count || 0) > 0 })
      .eq('id', clientId);
  }
}
