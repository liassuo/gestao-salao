import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { nowLocalIsoString } from '../common/datetime.util';
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

    const now = nowLocalIsoString();
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

    const now = nowLocalIsoString();
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

    const now = nowLocalIsoString();
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
    // Registros-ledger de dedução são memória interna do estorno, não débitos —
    // listá-los duplicava visualmente cada dedução parcial ("virou uma bagunça").
    return (data || []).filter(
      (d: any) => !ProfessionalDebtsService.isDeductionLedger(d),
    );
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
      .select('amount, amountPaid, remainingBalance, status, parentDebtId, description')
      .eq('professionalId', professionalId);

    if (error) throw error;

    // Ledgers fora das somas: o valor deles já está contido no amountPaid do
    // débito-pai — contá-los dobrava o total descontado.
    const list = (data || []).filter(
      (d: any) => !ProfessionalDebtsService.isDeductionLedger(d),
    );
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

    const now = nowLocalIsoString();
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
   * True para registros-ledger de dedução (não são débitos reais — só a memória
   * de quanto uma comissão cobriu de um débito-pai). Reconhece o formato novo
   * (parentDebtId) e o legado pré-migração (vínculo por prefixo na descrição).
   */
  static isDeductionLedger(d: {
    parentDebtId?: string | null;
    description?: string | null;
  }): boolean {
    return (
      !!d.parentDebtId ||
      (typeof d.description === 'string' &&
        d.description.startsWith('Dedução parcial do débito '))
    );
  }

  /**
   * Aplica dedução de débitos pendentes na comissão recém-gerada.
   * Estratégia:
   *   - Pega débitos PENDING do profissional, mais antigos primeiro.
   *   - Vai consumindo até esgotar a comissão (commissionAmount) ou os débitos.
   *   - Débito totalmente coberto -> DEDUCTED, vinculado à comissão.
   *   - Débito parcialmente coberto -> permanece PENDING com remainingBalance reduzido.
   *   - TODA dedução (total ou parcial) grava um registro-ledger com parentDebtId
   *     e o valor EXATO coberto — é ele que permite estornar com precisão ao
   *     regerar/excluir a comissão. Sem esse registro, o estorno da quitação
   *     total restaurava o débito ao valor ORIGINAL, ressuscitando partes já
   *     descontadas por outras comissões (o "bola de neve" de 07/2026).
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
    const now = nowLocalIsoString();

    for (const debt of pending) {
      if (budgetLeft <= 0) break;

      const cover = Math.min(budgetLeft, debt.remainingBalance);
      if (cover <= 0) continue;

      const newAmountPaid = debt.amountPaid + cover;
      const newRemaining = debt.remainingBalance - cover;
      const fullyCovered = newRemaining === 0;

      // Atualiza o débito-pai (mesma linha sempre; nunca recriada).
      const { error } = await this.supabase
        .from('professional_debts')
        .update({
          amountPaid: newAmountPaid,
          remainingBalance: newRemaining,
          status: fullyCovered ? 'DEDUCTED' : 'PENDING',
          deductedFromCommissionId: fullyCovered ? commissionId : null,
          settledAt: fullyCovered ? now : null,
          updatedAt: now,
        })
        .eq('id', debt.id);
      if (error) {
        this.logger.error(`Erro ao deduzir débito ${debt.id}: ${error.message}`);
        throw error;
      }

      // Ledger da dedução: registra o valor exato que ESTA comissão cobriu
      // DESTE débito. Fonte única do estorno; excluído de listagens/somas.
      const { error: ledgerError } = await this.supabase
        .from('professional_debts')
        .insert({
          id: randomUUID(),
          professionalId,
          orderId: null,
          parentDebtId: debt.id,
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
          `Erro ao criar registro de dedução: ${ledgerError.message}`,
        );
        throw ledgerError;
      }

      budgetLeft -= cover;
      totalDeducted += cover;
    }

    return totalDeducted;
  }

  /**
   * Estorna as deduções de débito feitas por um conjunto de comissões — usado
   * ANTES de apagar/regerar comissões PENDING, para a geração ser idempotente.
   *
   * Caminho normal (formato novo): cada dedução tem um ledger com parentDebtId
   * e o valor exato coberto → devolve exatamente esse valor ao débito-pai e
   * apaga o ledger. Nada além do que ESTA comissão cobriu é restaurado.
   *
   * Caminhos legados (dados pré-migração parentDebtId):
   *  (a) Ledger antigo sem parentDebtId → resolve o pai pelo prefixo de 8 chars
   *      da descrição (comportamento antigo).
   *  (b) Débito quitado integralmente SEM ledger (formato antigo da quitação
   *      total) → restaura amount MENOS a soma dos ledgers de OUTRAS comissões
   *      que apontam para ele. (Era aqui que o código antigo restaurava o valor
   *      ORIGINAL inteiro e ressuscitava deduções alheias — o "bola de neve".)
   */
  async reverseDeductionsForCommissions(commissionIds: string[]): Promise<void> {
    if (!commissionIds || commissionIds.length === 0) return;

    const { data: deductions } = await this.supabase
      .from('professional_debts')
      .select('id, professionalId, amount, amountPaid, description, orderId, parentDebtId')
      .eq('status', 'DEDUCTED')
      .in('deductedFromCommissionId', commissionIds);

    if (!deductions || deductions.length === 0) return;
    const now = nowLocalIsoString();

    // Separa ledgers de débitos-pai quitados no formato antigo. Processa os
    // ledgers PRIMEIRO: se o pai também estiver na lista (quitado por uma das
    // comissões estornadas), a devolução do ledger precisa acontecer antes do
    // cálculo do caminho legado (b).
    const ledgers = (deductions as any[]).filter((d) =>
      ProfessionalDebtsService.isDeductionLedger(d),
    );
    const legacyFull = (deductions as any[]).filter(
      (d) => !ProfessionalDebtsService.isDeductionLedger(d),
    );
    // Pais já restaurados via ledger nesta execução: no formato novo a quitação
    // total marca o PAI com deductedFromCommissionId E cria o ledger — o pai
    // também aparece na lista, mas o ledger já devolveu o valor exato; processá-lo
    // de novo no caminho legado seria dupla restauração.
    const handledParents = new Set<string>();

    for (const d of ledgers) {
      let parent: any = null;
      if (d.parentDebtId) {
        const { data } = await this.supabase
          .from('professional_debts')
          .select('id, amountPaid, remainingBalance, status')
          .eq('id', d.parentDebtId)
          .maybeSingle();
        parent = data;
      } else {
        // Ledger legado: vínculo só pelo prefixo na descrição.
        const match = /Dedução parcial do débito ([0-9a-f]{8})/.exec(d.description);
        if (match) {
          const { data: parents } = await this.supabase
            .from('professional_debts')
            .select('id, amountPaid, remainingBalance, status, description')
            .eq('professionalId', d.professionalId)
            .like('id', `${match[1]}%`);
          const candidates = (parents || []).filter(
            (p: any) => !ProfessionalDebtsService.isDeductionLedger(p),
          );
          if (candidates.length === 1) parent = candidates[0];
          else if (candidates.length > 1) {
            this.logger.warn(
              `Estorno: prefixo ${match[1]} ambíguo (${candidates.length} débitos); ledger ${d.id} mantido para análise manual`,
            );
            continue; // não devolve nem apaga — melhor manter rastro que corromper
          }
        }
      }

      if (parent && parent.status !== 'VOIDED') {
        await this.supabase
          .from('professional_debts')
          .update({
            amountPaid: Math.max(0, (parent.amountPaid || 0) - d.amount),
            remainingBalance: (parent.remainingBalance || 0) + d.amount,
            status: 'PENDING',
            deductedFromCommissionId: null,
            settledAt: null,
            updatedAt: now,
          })
          .eq('id', parent.id);
        handledParents.add(parent.id);
      }
      await this.supabase.from('professional_debts').delete().eq('id', d.id);
    }

    for (const d of legacyFull) {
      if (handledParents.has(d.id)) continue; // já restaurado via ledger acima
      // Formato antigo sem ledger: o quanto ESTA comissão cobriu não foi
      // registrado. Reconstrói por subtração: valor original MENOS o que os
      // ledgers de OUTRAS comissões (novo formato ou legado por prefixo)
      // registram como já coberto antes.
      const { data: byParentId } = await this.supabase
        .from('professional_debts')
        .select('id, amount, deductedFromCommissionId')
        .eq('parentDebtId', d.id)
        .eq('status', 'DEDUCTED');
      const { data: byPrefix } = await this.supabase
        .from('professional_debts')
        .select('id, amount, deductedFromCommissionId, description, parentDebtId')
        .eq('professionalId', d.professionalId)
        .eq('status', 'DEDUCTED')
        .like('description', `Dedução parcial do débito ${d.id.slice(0, 8)}%`);

      const otherLedgers = [
        ...(byParentId || []),
        ...(byPrefix || []).filter((l: any) => !l.parentDebtId), // evita contar 2x
      ].filter((l: any) => !commissionIds.includes(l.deductedFromCommissionId));

      const alreadyCoveredElsewhere = otherLedgers.reduce(
        (s: number, l: any) => s + (l.amount || 0),
        0,
      );
      const restore = Math.max(0, d.amount - alreadyCoveredElsewhere);

      await this.supabase
        .from('professional_debts')
        .update({
          amountPaid: Math.max(0, (d.amountPaid || 0) - restore),
          remainingBalance: restore,
          status: 'PENDING',
          deductedFromCommissionId: null,
          settledAt: null,
          updatedAt: now,
        })
        .eq('id', d.id);
    }
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
      .maybeSingle();

    if (openRegister) {
      await this.supabase
        .from('payments')
        .update({ cashRegisterId: openRegister.id })
        .eq('id', paymentId);
    }
  }
}
