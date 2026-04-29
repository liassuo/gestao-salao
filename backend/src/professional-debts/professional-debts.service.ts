import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateProfessionalDebtDto,
  QueryProfessionalDebtDto,
  SettleCashDto,
} from './dto';

@Injectable()
export class ProfessionalDebtsService {
  private readonly logger = new Logger(ProfessionalDebtsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private readonly SELECT = `
    *,
    professional:professionals(id, name),
    order:orders(id, totalAmount, status)
  `;

  /**
   * Lançamento manual (sem comanda). Para débitos vindos de comanda,
   * use createFromOrder() — chamado pelo OrdersService no fluxo de pagamento.
   */
  async create(dto: CreateProfessionalDebtDto) {
    await this.assertProfessionalExists(dto.professionalId);

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('professional_debts')
      .insert({
        id: randomUUID(),
        professionalId: dto.professionalId,
        orderId: null,
        amount: dto.amount,
        amountPaid: 0,
        remainingBalance: dto.amount,
        description: dto.description,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      })
      .select(this.SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Cria um débito a partir de uma comanda lançada como débito do profissional.
   * Chamado pelo OrdersService quando consumerType = PROFESSIONAL.
   */
  async createFromOrder(params: {
    professionalId: string;
    orderId: string;
    amount: number;
    description?: string;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('Valor da comanda deve ser positivo');
    }

    await this.assertProfessionalExists(params.professionalId);

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('professional_debts')
      .insert({
        id: randomUUID(),
        professionalId: params.professionalId,
        orderId: params.orderId,
        amount: params.amount,
        amountPaid: 0,
        remainingBalance: params.amount,
        description: params.description,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      })
      .select(this.SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Anula débitos vinculados a uma comanda específica (status = VOIDED).
   * Chamado quando a comanda-débito é cancelada.
   * Só age sobre débitos PENDING; débitos já deduzidos ou pagos em dinheiro
   * não são tocados (o ajuste teria que ser manual via comissão).
   */
  async voidByOrder(orderId: string): Promise<{ voidedCount: number }> {
    const { data: pending, error: findError } = await this.supabase
      .from('professional_debts')
      .select('id, status')
      .eq('orderId', orderId)
      .eq('status', 'PENDING');

    if (findError) throw findError;
    if (!pending || pending.length === 0) {
      return { voidedCount: 0 };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .from('professional_debts')
      .update({ status: 'VOIDED', updatedAt: now })
      .eq('orderId', orderId)
      .eq('status', 'PENDING');

    if (updateError) throw updateError;
    return { voidedCount: pending.length };
  }

  async findAll(query: QueryProfessionalDebtDto) {
    let qb = this.supabase
      .from('professional_debts')
      .select(this.SELECT);

    if (query.professionalId) qb = qb.eq('professionalId', query.professionalId);
    if (query.status) qb = qb.eq('status', query.status);

    const { data, error } = await qb.order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .from('professional_debts')
      .select(this.SELECT)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Débito do profissional não encontrado');
    }

    return data;
  }

  async findPendingByProfessional(professionalId: string) {
    const { data, error } = await this.supabase
      .from('professional_debts')
      .select(this.SELECT)
      .eq('professionalId', professionalId)
      .eq('status', 'PENDING')
      .order('createdAt', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getProfessionalSummary(professionalId: string) {
    const { data, error } = await this.supabase
      .from('professional_debts')
      .select('amount, amountPaid, remainingBalance, status')
      .eq('professionalId', professionalId);

    if (error) throw error;

    const list = data || [];
    const pending = list.filter((d) => d.status === 'PENDING');
    return {
      professionalId,
      totalPending: pending.reduce((s, d) => s + d.remainingBalance, 0),
      pendingCount: pending.length,
      totalAll: list.reduce((s, d) => s + d.amount, 0),
      totalPaid: list.reduce((s, d) => s + d.amountPaid, 0),
    };
  }

  /**
   * Quitação em dinheiro (caso o profissional prefira pagar em vez de descontar
   * da comissão). Cria registro em payments para entrar no caixa.
   */
  async settleCash(id: string, dto: SettleCashDto) {
    const debt = await this.findOne(id);

    if (debt.status !== 'PENDING') {
      throw new BadRequestException(
        `Não é possível quitar em dinheiro um débito com status ${debt.status}`,
      );
    }

    const amount = dto.amount ?? debt.remainingBalance;

    if (amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }
    if (amount > debt.remainingBalance) {
      throw new BadRequestException(
        `Valor excede o saldo devedor. Máximo: ${debt.remainingBalance} centavos`,
      );
    }

    const newAmountPaid = debt.amountPaid + amount;
    const newRemainingBalance = debt.remainingBalance - amount;
    const isNowSettled = newRemainingBalance === 0;

    const now = new Date().toISOString();
    const { data: updated, error } = await this.supabase
      .from('professional_debts')
      .update({
        amountPaid: newAmountPaid,
        remainingBalance: newRemainingBalance,
        status: isNowSettled ? 'SETTLED_CASH' : 'PENDING',
        settledAt: isNowSettled ? now : null,
        updatedAt: now,
      })
      .eq('id', id)
      .select(this.SELECT)
      .single();

    if (error) throw error;

    // Registra entrada no caixa. Profissional não é cliente, então clientId fica null.
    await this.createCashPaymentRecord({
      amount,
      method: dto.method || 'CASH',
      registeredBy: dto.registeredBy,
      notes: `Quitação de débito do profissional ${debt.professional?.name ?? debt.professionalId}${
        debt.description ? ' — ' + debt.description : ''
      }`,
      paidAt: now,
    });

    return updated;
  }

  /**
   * Aplica dedução de débitos pendentes na comissão recém-gerada.
   * Estratégia:
   *   - Pega débitos PENDING do profissional, mais antigos primeiro.
   *   - Vai consumindo até esgotar a comissão (commissionAmount) ou os débitos.
   *   - Débito totalmente coberto -> DEDUCTED, vinculado à comissão.
   *   - Débito parcialmente coberto -> permanece PENDING com remainingBalance reduzido,
   *     e cria-se um SEGUNDO registro DEDUCTED com a parte coberta para auditoria.
   *
   * Retorna o total deduzido, que será gravado em commissions.amountDeductedDebts.
   * Comissão NUNCA fica negativa.
   */
  async applyDeductionToCommission(params: {
    professionalId: string;
    commissionId: string;
    commissionAmount: number;
  }): Promise<number> {
    const { professionalId, commissionId, commissionAmount } = params;
    if (commissionAmount <= 0) return 0;

    const pending = await this.findPendingByProfessional(professionalId);
    if (pending.length === 0) return 0;

    let budgetLeft = commissionAmount;
    let totalDeducted = 0;
    const now = new Date().toISOString();

    for (const debt of pending) {
      if (budgetLeft <= 0) break;

      const cover = Math.min(budgetLeft, debt.remainingBalance);
      if (cover <= 0) continue;

      const newAmountPaid = debt.amountPaid + cover;
      const newRemaining = debt.remainingBalance - cover;
      const fullyCovered = newRemaining === 0;

      if (fullyCovered) {
        // Quita o débito direto, vinculando à comissão.
        const { error } = await this.supabase
          .from('professional_debts')
          .update({
            amountPaid: newAmountPaid,
            remainingBalance: 0,
            status: 'DEDUCTED',
            deductedFromCommissionId: commissionId,
            settledAt: now,
            updatedAt: now,
          })
          .eq('id', debt.id);
        if (error) {
          this.logger.error(`Erro ao deduzir débito ${debt.id}: ${error.message}`);
          throw error;
        }
      } else {
        // Cobertura parcial: mantém PENDING com saldo reduzido,
        // e cria um registro DEDUCTED só com a parte coberta (auditoria).
        const { error: partialError } = await this.supabase
          .from('professional_debts')
          .update({
            amountPaid: newAmountPaid,
            remainingBalance: newRemaining,
            updatedAt: now,
          })
          .eq('id', debt.id);
        if (partialError) {
          this.logger.error(
            `Erro ao deduzir parcialmente débito ${debt.id}: ${partialError.message}`,
          );
          throw partialError;
        }

        const { error: ledgerError } = await this.supabase
          .from('professional_debts')
          .insert({
            id: randomUUID(),
            professionalId,
            orderId: null,
            amount: cover,
            amountPaid: cover,
            remainingBalance: 0,
            description: `Dedução parcial do débito ${debt.id.slice(0, 8)}${
              debt.description ? ' — ' + debt.description : ''
            }`,
            status: 'DEDUCTED',
            deductedFromCommissionId: commissionId,
            settledAt: now,
            createdAt: now,
            updatedAt: now,
          });
        if (ledgerError) {
          this.logger.error(
            `Erro ao criar registro de dedução parcial: ${ledgerError.message}`,
          );
          throw ledgerError;
        }
      }

      budgetLeft -= cover;
      totalDeducted += cover;
    }

    return totalDeducted;
  }

  async remove(id: string): Promise<void> {
    const debt = await this.findOne(id);

    if (debt.status !== 'PENDING') {
      throw new BadRequestException(
        'Apenas débitos pendentes podem ser excluídos',
      );
    }
    if (debt.orderId) {
      throw new BadRequestException(
        'Débitos vinculados a comandas devem ser revertidos cancelando a comanda',
      );
    }

    const { error } = await this.supabase
      .from('professional_debts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // -------------- helpers --------------

  private async assertProfessionalExists(professionalId: string) {
    const { data, error } = await this.supabase
      .from('professionals')
      .select('id')
      .eq('id', professionalId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Profissional não encontrado');
    }
  }

  private async createCashPaymentRecord(params: {
    amount: number;
    method: string;
    registeredBy?: string;
    notes?: string;
    paidAt: string;
  }): Promise<void> {
    let userId = params.registeredBy;
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

    const paymentId = randomUUID();
    await this.supabase.from('payments').insert({
      id: paymentId,
      clientId: null,
      amount: params.amount,
      method: params.method,
      paidAt: params.paidAt,
      registeredBy: userId,
      notes: params.notes,
      createdAt: params.paidAt,
      updatedAt: params.paidAt,
    });

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
}
