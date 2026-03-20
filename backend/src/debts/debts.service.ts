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

  private readonly DEBT_SELECT = `
    *,
    client:clients(id, name, phone)
  `;

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
    const now = new Date().toISOString();
    const { data: debt, error } = await this.supabase
      .from('debts')
      .insert({
        id: crypto.randomUUID(),
        clientId: dto.clientId,
        appointmentId: dto.appointmentId,
        amount: dto.amount,
        amountPaid: 0,
        remainingBalance: dto.amount,
        description: dto.description,
        dueDate: dto.dueDate,
        isSettled: false,
        createdAt: now,
        updatedAt: now,
      })
      .select(this.DEBT_SELECT)
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

    const d = new Date();
    const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    const { data: updatedDebt, error: updateError } = await this.supabase
      .from('debts')
      .update({
        amountPaid: newAmountPaid,
        remainingBalance: newRemainingBalance,
        isSettled: isNowSettled,
        paidAt: isNowSettled ? now : null,
      })
      .eq('id', debtId)
      .select(this.DEBT_SELECT)
      .single();

    if (updateError) throw updateError;

    // Criar registro de pagamento para o caixa contabilizar
    await this.createPaymentRecord(
      debt.clientId,
      dto.amount,
      dto.method || 'CASH',
      dto.registeredBy,
      `Pagamento de dívida${debt.description ? ': ' + debt.description : ''}`,
      now,
    );

    // Se quitou, verificar se cliente ainda tem outras dívidas
    if (isNowSettled) {
      await this.updateClientHasDebtsFlag(debt.clientId);
    }

    return updatedDebt;
  }

  async settleDebt(id: string, method?: string) {
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

    const d = new Date();
    const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    const { data: updatedDebt, error: updateError } = await this.supabase
      .from('debts')
      .update({
        amountPaid: debt.amount,
        remainingBalance: 0,
        isSettled: true,
        paidAt: now,
      })
      .eq('id', id)
      .select(this.DEBT_SELECT)
      .single();

    if (updateError) throw updateError;

    // Registrar o valor restante como pagamento no caixa
    if (debt.remainingBalance > 0) {
      await this.createPaymentRecord(
        debt.clientId,
        debt.remainingBalance,
        method || 'CASH',
        undefined,
        `Quitação de dívida${debt.description ? ': ' + debt.description : ''}`,
        now,
      );
    }

    await this.updateClientHasDebtsFlag(debt.clientId);

    return updatedDebt;
  }

  async findOne(id: string) {
    const { data: debt, error } = await this.supabase
      .from('debts')
      .select(this.DEBT_SELECT)
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
      .select(this.DEBT_SELECT)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findOutstanding() {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select(this.DEBT_SELECT)
      .eq('isSettled', false)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findByClient(clientId: string) {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select(this.DEBT_SELECT)
      .eq('clientId', clientId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return debts || [];
  }

  async findOutstandingByClient(clientId: string) {
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select(this.DEBT_SELECT)
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
      .select(this.DEBT_SELECT)
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

  /**
   * Cria um registro na tabela payments para que o caixa contabilize o valor.
   */
  private async createPaymentRecord(
    clientId: string,
    amount: number,
    method: string,
    registeredBy?: string,
    notes?: string,
    paidAt?: string,
  ): Promise<void> {
    // Se não tem registeredBy, buscar primeiro admin
    let userId = registeredBy;
    if (!userId) {
      const { data: admin } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .limit(1)
        .single();
      userId = admin?.id;
    }

    if (!userId) return;

    const now = paidAt || new Date().toISOString();
    const paymentId = crypto.randomUUID();
    await this.supabase.from('payments').insert({
      id: paymentId,
      clientId,
      amount,
      method,
      paidAt: now,
      registeredBy: userId,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    // Vincular ao caixa aberto
    const { data: openRegister } = await this.supabase
      .from('cash_registers')
      .select('id')
      .eq('isOpen', true)
      .single();

    if (openRegister) {
      await this.supabase
        .from('payments')
        .update({ cashRegisterId: openRegister.id })
        .eq('id', paymentId);
    }
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
