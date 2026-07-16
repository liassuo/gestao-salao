import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { nowLocalIsoString } from '../common/datetime.util';
import { CreateDebtDto, UpdateDebtDto, PayDebtDto } from './dto';
import { AsaasService } from '../asaas/asaas.service';
import { AsaasBillingType } from '../asaas/asaas.types';
import {
  reactivateSubscriptionForSettledDebt,
  resolveSubscriptionForDelinquencyDebt,
} from '../common/debt-settlement.helper';

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
  ) {}

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
    const now = nowLocalIsoString();
    const { data: debt, error } = await this.supabase
      .from('debts')
      .insert({
        id: randomUUID(),
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

    // Dívida de MENSALIDADE quitada no balcão: o pagamento precisa ficar vinculado
    // à assinatura, senão isCurrentCyclePaid não o enxerga e ela volta ACTIVE com
    // "ciclo não pago" — o corte segue sendo cobrado do cliente (mesmo sintoma que
    // a reativação pretende resolver).
    const subscriptionId = await resolveSubscriptionForDelinquencyDebt(
      this.supabase,
      debt.clientId,
      debt.description,
    );

    // Registrar o valor restante como pagamento no caixa
    if (debt.remainingBalance > 0) {
      await this.createPaymentRecord(
        debt.clientId,
        debt.remainingBalance,
        method || 'CASH',
        undefined,
        `Quitação de dívida${debt.description ? ': ' + debt.description : ''}`,
        now,
        subscriptionId,
      );
    }

    await this.updateClientHasDebtsFlag(debt.clientId);

    // Reativa a assinatura suspensa cuja mensalidade acabou de ser paga. Sem isto,
    // quitar pela tela de dívidas deixava o cliente "sem-dívida-e-encerrado" —
    // estado irrecuperável por reconciliação (a dívida era a prova do débito).
    if (subscriptionId) {
      const reactivated = await reactivateSubscriptionForSettledDebt(
        { supabase: this.supabase, logger: this.logger },
        debt.clientId,
        subscriptionId,
      ).catch((e) => {
        this.logger.error(`Falha ao reativar assinatura ${subscriptionId} pós-quitação: ${e}`);
        return false;
      });

      // Ciclo pago no balcão → cancela o link Asaas em aberto do mesmo ciclo, senão
      // o gateway segue cobrando o cliente e ele pode pagar em dobro (caso Renato
      // dias, 16/07/2026). Mesmo tratamento do PR #44 na confirmação manual.
      if (reactivated) {
        await this.cancelPendingAsaasChargesForSubscription(subscriptionId, now);
      }
    }

    return updatedDebt;
  }

  /**
   * Cancela no Asaas as cobranças ainda PENDENTES do ciclo desta assinatura, depois
   * que ele foi pago por fora (balcão). Espelha subscriptions.service — best-effort:
   * falha só loga, com instrução de cancelar manualmente.
   */
  private async cancelPendingAsaasChargesForSubscription(
    subscriptionId: string,
    nowLocal: string,
  ): Promise<void> {
    if (!this.asaasService.configured) return;

    const { data: pending } = await this.supabase
      .from('payments')
      .select('id, asaasPaymentId')
      .eq('subscriptionId', subscriptionId)
      .eq('asaasStatus', 'PENDING')
      .is('paidAt', null)
      .not('asaasPaymentId', 'is', null);

    for (const p of pending || []) {
      try {
        await this.asaasService.cancelCharge((p as any).asaasPaymentId);
        await this.supabase
          .from('payments')
          .update({ asaasStatus: 'CANCELED', updatedAt: nowLocal })
          .eq('id', (p as any).id);
        this.logger.log(
          `Cobrança pendente ${(p as any).asaasPaymentId} cancelada (mensalidade quitada no balcão, assinatura ${subscriptionId}).`,
        );
      } catch (e: any) {
        this.logger.warn(
          `Não foi possível cancelar cobrança pendente ${(p as any).asaasPaymentId} da assinatura ${subscriptionId}: ${e?.message} — cancelar manualmente no Asaas para evitar pagamento em dobro.`,
        );
      }
    }
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
    subscriptionId?: string | null,
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

    const now = paidAt || nowLocalIsoString();
    const paymentId = randomUUID();
    await this.supabase.from('payments').insert({
      id: paymentId,
      clientId,
      amount,
      method,
      paidAt: now,
      registeredBy: userId,
      // Mensalidade quitada no balcão: vincular à assinatura é o que faz o ciclo
      // constar pago (isCurrentCyclePaid filtra por subscriptionId) e o cliente
      // voltar a usar os cortes do plano.
      ...(subscriptionId ? { subscriptionId } : {}),
      notes,
      createdAt: now,
      updatedAt: now,
    });

    // Vincular ao caixa aberto
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

  async createPixChargeForDebts(clientId: string): Promise<{
    pixData: { encodedImage: string; payload: string; expirationDate: string } | null;
    totalAmount: number;
  }> {
    // 1. Buscar dívidas pendentes
    const { data: debts, error } = await this.supabase
      .from('debts')
      .select('remainingBalance')
      .eq('clientId', clientId)
      .eq('isSettled', false);

    if (error) throw error;
    if (!debts || debts.length === 0) {
      throw new BadRequestException('Nenhuma dívida pendente encontrada');
    }

    const totalAmount = debts.reduce((sum, d) => sum + d.remainingBalance, 0);

    if (!this.asaasService.configured) {
      throw new BadRequestException(
        'Pagamento PIX não está disponível. Entre em contato com o salão para quitar sua dívida.',
      );
    }

    // 2. Buscar/criar cliente no Asaas
    const { data: client } = await this.supabase
      .from('clients')
      .select('id, name, email, phone, asaasCustomerId')
      .eq('id', clientId)
      .single();

    if (!client) throw new NotFoundException('Cliente não encontrado');

    let asaasCustomerId = client.asaasCustomerId;
    if (!asaasCustomerId) {
      const newCustomer = await this.asaasService.createCustomer({
        name: client.name,
        email: client.email || undefined,
        mobilePhone: client.phone || undefined,
        externalReference: client.id,
      });
      asaasCustomerId = newCustomer.id;
      await this.supabase
        .from('clients')
        .update({ asaasCustomerId })
        .eq('id', clientId);
    }

    // 3. Criar cobrança PIX no Asaas
    const today = nowLocalIsoString().substring(0, 10);
    const asaasCharge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: AsaasBillingType.PIX,
      value: this.asaasService.centavosToReais(totalAmount),
      dueDate: today,
      description: 'Quitação de dívida',
      externalReference: clientId,
    });

    // 4. Registrar pagamento pendente para rastreamento. É este espelho (com
    // notes='DEBT_PAYMENT') que o webhook usa para quitar as dívidas e reativar
    // a assinatura quando o PIX confirma. registeredBy é NOT NULL na tabela —
    // sem ele o insert falhava em SILÊNCIO desde 03/2026 (erro não checado) e
    // nenhum pagamento de dívida baixava sozinho (caso Paulo Sergio 16/07/2026).
    const { data: systemAdmin } = await this.supabase
      .from('users')
      .select('id')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    const now = nowLocalIsoString();
    const { error: mirrorError } = await this.supabase.from('payments').insert({
      id: randomUUID(),
      clientId,
      amount: totalAmount,
      method: 'PIX',
      registeredBy: systemAdmin?.id ?? null,
      asaasPaymentId: asaasCharge.id,
      asaasStatus: asaasCharge.status,
      notes: 'DEBT_PAYMENT',
      createdAt: now,
      updatedAt: now,
    });
    if (mirrorError) {
      // Não aborta a cobrança (o cliente precisa do QR Code) — o fallback do
      // webhook para externalReference=clientId recria o espelho na confirmação.
      this.logger.error(
        `createPixChargeForDebts: falha ao criar espelho DEBT_PAYMENT de ${asaasCharge.id}: ${mirrorError.message}`,
      );
    }

    // 5. Buscar QR Code PIX
    const pixData = await this.asaasService.getPixQrCode(asaasCharge.id);

    return { pixData, totalAmount };
  }
}
