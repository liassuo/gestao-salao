import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { nowLocalIsoString, resolveBusinessDate } from '../common/datetime.util';
import { AsaasService } from './asaas.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { AsaasWebhookEvent, AsaasChargeStatus } from './asaas.types';
import { Public } from '../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Webhooks')
@Public()
@SkipThrottle()
@Controller('webhooks')
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
    private readonly cashRegisterService: CashRegisterService,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook para receber notificações do Asaas' })
  async handleWebhook(
    @Body() body: any,
    @Headers('asaas-access-token') accessToken?: string,
  ) {
    // Validar token de segurança
    const webhookToken = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (webhookToken && webhookToken !== 'your-webhook-secret-token') {
      if (accessToken !== webhookToken) {
        this.logger.warn('Webhook recebido com token inválido');
        throw new ForbiddenException('Token inválido');
      }
    }

    const event = body.event as AsaasWebhookEvent;
    const paymentData = body.payment;

    if (!event || !paymentData) {
      this.logger.warn('Webhook recebido sem evento ou dados de pagamento');
      return { received: true };
    }

    this.logger.log(
      `Webhook Asaas recebido: ${event} - Payment: ${paymentData.id}`,
    );

    try {
      switch (event) {
        case AsaasWebhookEvent.PAYMENT_RECEIVED:
        case AsaasWebhookEvent.PAYMENT_CONFIRMED:
          await this.handlePaymentConfirmed(paymentData);
          break;

        case AsaasWebhookEvent.PAYMENT_OVERDUE:
          await this.handlePaymentOverdue(paymentData);
          break;

        case AsaasWebhookEvent.PAYMENT_REFUNDED:
        case AsaasWebhookEvent.PAYMENT_REFUND_IN_PROGRESS:
          await this.handlePaymentRefunded(paymentData);
          break;

        case AsaasWebhookEvent.PAYMENT_DELETED:
          await this.handlePaymentDeleted(paymentData);
          break;

        default:
          this.logger.log(`Evento não tratado: ${event}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar webhook: ${error}`);
    }

    return { received: true };
  }

  /**
   * Pagamento confirmado - atualizar status local
   * Idempotente: verifica se já foi processado antes de aplicar mudanças
   */
  private async handlePaymentConfirmed(paymentData: any) {
    const asaasPaymentId = paymentData.id;
    const status = paymentData.status as AsaasChargeStatus;

    this.logger.log(
      `Pagamento confirmado: ${asaasPaymentId} (${status})`,
    );

    // Buscar pagamento local pelo asaasPaymentId
    let { data: localPayment } = await this.supabase
      .from('payments')
      .select('id, appointmentId, clientId, amount, subscriptionId, asaasStatus, paidAt, notes')
      .eq('asaasPaymentId', asaasPaymentId)
      .maybeSingle();

    // Flag para diferenciar "payment recem-criado pelo fallback" de "payment pre-existente
    // ja confirmado". A checagem de idempotencia abaixo so deve disparar no segundo caso.
    let justCreatedByFallback = false;

    // Fallback: se o payments local sumiu, mas o webhook traz externalReference apontando
    // para uma assinatura existente, recria o registro local antes de seguir.
    // Cobre o caso "cliente pagou PIX, Asaas confirmou, payments local nunca foi inserido
    // por race condition / falha de DB".
    if (!localPayment) {
      const externalRef: string | undefined = paymentData.externalReference;
      const asaasSubId: string | undefined = paymentData.subscription;
      // Assinatura recorrente: a cobrança de cada ciclo chega sem payment local.
      // Resolve a assinatura por externalReference (= id local) OU pelo id da
      // assinatura Asaas (campo payment.subscription) — não depende de só um deles.
      let linkedSub: { id: string; clientId: string } | null = null;
      if (externalRef) {
        ({ data: linkedSub } = await this.supabase
          .from('client_subscriptions')
          .select('id, clientId')
          .eq('id', externalRef)
          .maybeSingle());
      }
      if (!linkedSub && asaasSubId) {
        ({ data: linkedSub } = await this.supabase
          .from('client_subscriptions')
          .select('id, clientId')
          .eq('asaasSubscriptionId', asaasSubId)
          .maybeSingle());
      }
      if (externalRef || asaasSubId) {
        if (linkedSub) {
          const billingType = paymentData.billingType || 'PIX';
          const localMethod = billingType === 'CREDIT_CARD' ? 'CARD' : 'PIX';
          const valueReais = Number(paymentData.value || 0);
          const amountCentavos = Math.round(valueReais * 100);
          const now = nowLocalIsoString();
          const newId = require('crypto').randomUUID();

          // paidAt e NOT NULL na tabela: como o webhook esta confirmando o pagamento
          // (status CONFIRMED/RECEIVED), preferimos a data confirmada do Asaas;
          // caso ausente, caimos no agora local.
          const confirmedAt =
            paymentData.confirmedDate ||
            paymentData.clientPaymentDate ||
            paymentData.paymentDate ||
            now;
          // registeredBy é NOT NULL e FK pra users.id. Webhook não tem admin
          // associado, então pegamos o primeiro admin disponivel como "registrante
          // sistema". Mesmo padrao do cash-register.service.ts:openRegister.
          const { data: systemAdmin } = await this.supabase
            .from('users')
            .select('id')
            .eq('role', 'ADMIN')
            .limit(1)
            .maybeSingle();

          if (!systemAdmin) {
            this.logger.error(
              `Webhook fallback: nenhum admin encontrado para usar como registeredBy de ${asaasPaymentId}. Cron de reconciliacao vai cobrir.`,
            );
            return;
          }

          const { error: insertError } = await this.supabase
            .from('payments')
            .insert({
              id: newId,
              clientId: linkedSub.clientId,
              subscriptionId: linkedSub.id,
              amount: amountCentavos,
              method: localMethod,
              registeredBy: systemAdmin.id,
              notes: `Reconciliação webhook (cobrança ${asaasPaymentId})`,
              asaasPaymentId,
              asaasStatus: status,
              paidAt: confirmedAt,
              // Assinatura não tem agendamento → data contábil = dia do pagamento.
              businessDate: resolveBusinessDate(null, confirmedAt),
              invoiceUrl: paymentData.invoiceUrl || null,
              bankSlipUrl: paymentData.bankSlipUrl || null,
              createdAt: now,
              updatedAt: now,
            });

          if (insertError) {
            this.logger.error(
              `Webhook fallback: falha ao recriar payments para ${asaasPaymentId}: ${insertError.message}`,
            );
            return;
          }

          this.logger.warn(
            `Webhook fallback: payments local recriado para ${asaasPaymentId} (assinatura ${linkedSub.id})`,
          );

          localPayment = {
            id: newId,
            appointmentId: null,
            clientId: linkedSub.clientId,
            amount: amountCentavos,
            subscriptionId: linkedSub.id,
            asaasStatus: status,
            paidAt: confirmedAt,
            notes: `Reconciliação webhook (cobrança ${asaasPaymentId})`,
          };
          justCreatedByFallback = true;
        } else {
          // Não é assinatura: tentar casar o externalReference com um AGENDAMENTO.
          // Cobre "cliente pagou PIX do agendamento, mas o payments local nunca foi
          // inserido (race/falha de DB)" — antes só assinatura tinha esse resgate.
          const { data: linkedAppt } = await this.supabase
            .from('appointments')
            .select('id, clientId, scheduledAt')
            .eq('id', externalRef)
            .maybeSingle();

          if (linkedAppt) {
            const billingType = paymentData.billingType || 'PIX';
            const localMethod = billingType === 'CREDIT_CARD' ? 'CARD' : 'PIX';
            const amountCentavos = Math.round(Number(paymentData.value || 0) * 100);
            const now = nowLocalIsoString();
            const confirmedAt =
              paymentData.confirmedDate ||
              paymentData.clientPaymentDate ||
              paymentData.paymentDate ||
              now;
            const businessDate = resolveBusinessDate((linkedAppt as any).scheduledAt, confirmedAt);
            const newId = require('crypto').randomUUID();

            const { data: systemAdmin } = await this.supabase
              .from('users')
              .select('id')
              .eq('role', 'ADMIN')
              .limit(1)
              .maybeSingle();
            if (!systemAdmin) {
              this.logger.error(
                `Webhook fallback (agendamento): nenhum admin para registeredBy de ${asaasPaymentId}. Cron de reconciliação vai cobrir.`,
              );
              return;
            }

            const { error: insErr } = await this.supabase.from('payments').insert({
              id: newId,
              clientId: (linkedAppt as any).clientId,
              appointmentId: (linkedAppt as any).id,
              amount: amountCentavos,
              method: localMethod,
              registeredBy: systemAdmin.id,
              notes: `Reconciliação webhook (cobrança ${asaasPaymentId})`,
              asaasPaymentId,
              asaasStatus: status,
              paidAt: confirmedAt,
              businessDate,
              createdAt: now,
              updatedAt: now,
            });
            if (insErr) {
              this.logger.error(
                `Webhook fallback (agendamento): falha ao recriar payments para ${asaasPaymentId}: ${insErr.message}`,
              );
              return;
            }
            this.logger.warn(
              `Webhook fallback: payments recriado para ${asaasPaymentId} (agendamento ${(linkedAppt as any).id})`,
            );
            localPayment = {
              id: newId,
              appointmentId: (linkedAppt as any).id,
              clientId: (linkedAppt as any).clientId,
              amount: amountCentavos,
              subscriptionId: null,
              asaasStatus: status,
              paidAt: confirmedAt,
              notes: `Reconciliação webhook (cobrança ${asaasPaymentId})`,
            };
            justCreatedByFallback = true;
          }
        }
      }
    }

    if (!localPayment) {
      this.logger.warn(
        `Pagamento local não encontrado para Asaas ID: ${asaasPaymentId} (externalReference=${paymentData.externalReference || 'n/a'})`,
      );
      return;
    }

    // Idempotência: se o pagamento JÁ estava confirmado localmente, não repetir os
    // efeitos FINANCEIROS (re-gravar paidAt/businessDate, vincular caixa, ativar
    // assinatura, criar dívida). MAS a promoção do agendamento (isPaid + status)
    // SEMPRE roda — ela é idempotente e é justamente o que cura um agendamento que
    // ficou preso em PENDING_PAYMENT (ou foi cancelado por engano pelo cron) quando
    // um 1º webhook gravou paidAt mas a promoção de status falhou. Antes isto era um
    // `return` seco e a promoção nunca acontecia → o cron acabava cancelando o
    // agendamento pago.
    const alreadyProcessed =
      !justCreatedByFallback &&
      !!localPayment.paidAt &&
      (localPayment.asaasStatus === 'RECEIVED' || localPayment.asaasStatus === 'CONFIRMED');

    if (alreadyProcessed) {
      this.logger.log(
        `Webhook ${asaasPaymentId} já processado (${localPayment.asaasStatus}) — pulando efeitos financeiros, mas garantindo a promoção do agendamento.`,
      );
    }

    // Atualizar status do pagamento. Data contábil (businessDate): dia do
    // atendimento quando há agendamento; senão o dia REAL do pagamento informado
    // pelo Asaas (confirmedDate/clientPaymentDate/paymentDate) — não o "agora".
    // Usar o agora jogava a venda no caixa do dia em que o webhook chegou, que
    // pode ser depois do pagamento (webhook atrasado/reprocessado) e, para
    // assinatura (sem agendamento), inflava o faturamento do dia errado.
    const confirmNow = nowLocalIsoString();
    const asaasPaidAt: string =
      paymentData.confirmedDate ||
      paymentData.clientPaymentDate ||
      paymentData.paymentDate ||
      confirmNow;
    let confirmScheduledAt: string | null = null;
    if (localPayment.appointmentId) {
      const { data: appt } = await this.supabase
        .from('appointments')
        .select('scheduledAt')
        .eq('id', localPayment.appointmentId)
        .maybeSingle();
      confirmScheduledAt = (appt as any)?.scheduledAt ?? null;
    }
    // Sem agendamento → fallback é a data real do pagamento (asaasPaidAt), não o agora.
    const confirmBusinessDate = resolveBusinessDate(confirmScheduledAt, asaasPaidAt);

    // Efeito financeiro (não repetir se já processado): grava paidAt/businessDate.
    if (!alreadyProcessed) {
      await this.supabase
        .from('payments')
        .update({
          asaasStatus: status,
          paidAt: asaasPaidAt,
          businessDate: confirmBusinessDate,
        })
        .eq('id', localPayment.id);
    }

    // Se vinculado a agendamento, marcar como pago e confirmar/RESTAURAR o status.
    // SEMPRE roda (mesmo se alreadyProcessed) — é idempotente e cura o agendamento
    // que ficou PENDING_PAYMENT ou foi cancelado por engano pelo cron na janela de race.
    if (localPayment.appointmentId) {
      // Estado atual: precisamos distinguir cancelamento AUTOMÁTICO do cron (race —
      // canceledAt fica NULL) de cancelamento DELIBERADO (cliente/no-show/valor-mudou —
      // setam canceledAt). Só restauramos o primeiro; um cancelamento intencional NÃO
      // deve ser ressuscitado por um pagamento que chegou atrasado.
      const { data: apptState } = await this.supabase
        .from('appointments')
        .select('status, canceledAt')
        .eq('id', localPayment.appointmentId)
        .maybeSingle();

      const canRestoreCancel =
        (apptState as any)?.status === 'CANCELED' && !(apptState as any)?.canceledAt;

      // Marcar pago é sempre seguro e incondicional (não depende do status atual).
      await this.supabase
        .from('appointments')
        .update({ isPaid: true, updatedAt: nowLocalIsoString() })
        .eq('id', localPayment.appointmentId);

      // Promover → SCHEDULED. Sempre cobre PENDING_PAYMENT; cobre CANCELED apenas
      // quando foi cancelamento AUTOMÁTICO do cron na corrida (canceledAt NULL),
      // restaurando o agendamento. Cancelamentos deliberados (canceledAt setado)
      // NÃO são ressuscitados.
      const promoteStatuses = canRestoreCancel
        ? ['PENDING_PAYMENT', 'CANCELED']
        : ['PENDING_PAYMENT'];
      await this.supabase
        .from('appointments')
        .update({ status: 'SCHEDULED', updatedAt: nowLocalIsoString() })
        .eq('id', localPayment.appointmentId)
        .in('status', promoteStatuses);

      // Pagar comanda vinculada (reabre se foi cancelada pelo mesmo cron na corrida).
      const orderStatuses = canRestoreCancel ? ['PENDING', 'CANCELED'] : ['PENDING'];
      await this.supabase
        .from('orders')
        .update({ status: 'PAID', paymentId: localPayment.id, updatedAt: nowLocalIsoString() })
        .eq('appointmentId', localPayment.appointmentId)
        .in('status', orderStatuses);
    }

    // A partir daqui, efeitos colaterais financeiros que NÃO devem repetir.
    if (alreadyProcessed) {
      this.logger.log(`Webhook ${asaasPaymentId}: promoção do agendamento garantida; efeitos financeiros pulados (idempotência).`);
      return;
    }

    // Se NÃO vinculado a agendamento, verificar se é pagamento de comanda vinculada a agendamento
    if (!localPayment.appointmentId) {
      const { data: linkedOrder } = await this.supabase
        .from('orders')
        .select('id, appointmentId')
        .eq('paymentId', localPayment.id)
        .maybeSingle();

      if (linkedOrder?.appointmentId) {
        await this.supabase
          .from('appointments')
          .update({ isPaid: true, updatedAt: nowLocalIsoString() })
          .eq('id', linkedOrder.appointmentId);

        await this.supabase
          .from('orders')
          .update({ status: 'PAID', updatedAt: nowLocalIsoString() })
          .eq('id', linkedOrder.id)
          .eq('status', 'PENDING');
      }
    }

    // Vincular ao caixa do DIA CONTÁBIL (businessDate) — dia do atendimento quando
    // há agendamento. Pode não ser o caixa aberto agora. Se aquele caixa já estiver
    // fechado, o serviço recalcula seus totais para refletir este pagamento.
    await this.cashRegisterService.linkPaymentToBusinessDateRegister(
      localPayment.id,
      confirmBusinessDate,
    );

    // Se vinculado a assinatura, ativar e estender endDate + resetar cortes
    if (localPayment.subscriptionId) {
      const now = new Date();

      const { data: currentSub } = await this.supabase
        .from('client_subscriptions')
        .select('status, endDate')
        .eq('id', localPayment.subscriptionId)
        .single();

      // Regra do vencimento:
      //  - 1ª ativação (assinatura ainda NÃO estava ACTIVE — veio de PENDING_PAYMENT/
      //    SUSPENDED): o ciclo começa no pagamento → agora + 1 mês. Não estender o
      //    endDate da criação (que já era "agora + 1 mês"), senão infla p/ 2 meses.
      //  - Renovação recorrente (já estava ACTIVE): acumula a partir do endDate atual
      //    (ou de hoje, se já venceu), preservando o dia de cobrança.
      const wasActive = currentSub?.status === 'ACTIVE';
      const currentEnd = currentSub?.endDate ? new Date(currentSub.endDate) : now;
      const baseDate = wasActive && currentEnd > now ? currentEnd : now;
      const newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);

      await this.supabase
        .from('client_subscriptions')
        .update({
          status: 'ACTIVE',
          cutsUsedThisMonth: 0,
          lastResetDate: now.toISOString(),
          endDate: newEndDate.toISOString(),
          updatedAt: now.toISOString(),
        })
        .eq('id', localPayment.subscriptionId);

      this.logger.log(
        `Assinatura ${localPayment.subscriptionId} ativada/renovada até ${newEndDate.toISOString()}`,
      );

      // Quitar a dívida de "Cobrança não paga" criada quando este mesmo pagamento ficou OVERDUE.
      // A correlação é feita pela tag [asaas:<id>] embutida na descrição.
      await this.settleOverdueDebtForPayment(localPayment.clientId, asaasPaymentId);
    }

    // Se for pagamento de dívida, quitar dívidas apenas se o valor pago cobre o total pendente
    if (localPayment.notes === 'DEBT_PAYMENT' && localPayment.clientId) {
      const debtNow = nowLocalIsoString();

      const { data: pendingDebts } = await this.supabase
        .from('debts')
        .select('id, amount, remainingBalance')
        .eq('clientId', localPayment.clientId)
        .eq('isSettled', false);

      const totalPending = (pendingDebts || []).reduce(
        (sum, d) => sum + (d.remainingBalance ?? d.amount),
        0,
      );

      if (localPayment.amount < totalPending) {
        this.logger.warn(
          `Pagamento de dívida insuficiente para cliente ${localPayment.clientId}: ` +
          `pago ${localPayment.amount}, total pendente atual ${totalPending}. Dívidas não quitadas.`,
        );
        return;
      }

      for (const debt of pendingDebts || []) {
        await this.supabase
          .from('debts')
          .update({
            amountPaid: debt.amount,
            remainingBalance: 0,
            isSettled: true,
            paidAt: debtNow,
          })
          .eq('id', debt.id);
      }

      await this.supabase
        .from('clients')
        .update({ hasDebts: false })
        .eq('id', localPayment.clientId);

      this.logger.log(
        `Dívidas do cliente ${localPayment.clientId} quitadas via PIX (${pendingDebts?.length || 0} dívida(s))`,
      );
    }

    this.logger.log(
      `Pagamento local ${localPayment.id} atualizado como confirmado`,
    );
  }

  /**
   * Pagamento vencido — suspende assinatura vinculada
   */
  private async handlePaymentOverdue(paymentData: any) {
    const asaasPaymentId = paymentData.id;

    this.logger.log(`Pagamento vencido: ${asaasPaymentId}`);

    await this.supabase
      .from('payments')
      .update({ asaasStatus: AsaasChargeStatus.OVERDUE })
      .eq('asaasPaymentId', asaasPaymentId);

    const now = nowLocalIsoString();

    // Buscar pagamento local com dados do cliente
    let { data: localPayment } = await this.supabase
      .from('payments')
      .select('id, clientId, amount, subscriptionId')
      .eq('asaasPaymentId', asaasPaymentId)
      .single();

    if (!localPayment) {
      // Renovação recorrente: a cobrança do novo ciclo ainda não tem payment local.
      // Recria a partir do externalReference (= id da assinatura), igual ao caminho de
      // confirmação, p/ poder suspender e lançar a dívida. Sem isso, só o cron de
      // vencimento suspenderia e nenhuma dívida seria criada.
      const externalRef: string | undefined = paymentData.externalReference;
      const asaasSubId: string | undefined = paymentData.subscription;
      let linkedSub: { id: string; clientId: string } | null = null;
      if (externalRef) {
        ({ data: linkedSub } = await this.supabase
          .from('client_subscriptions')
          .select('id, clientId')
          .eq('id', externalRef)
          .maybeSingle());
      }
      if (!linkedSub && asaasSubId) {
        ({ data: linkedSub } = await this.supabase
          .from('client_subscriptions')
          .select('id, clientId')
          .eq('asaasSubscriptionId', asaasSubId)
          .maybeSingle());
      }
      if (!linkedSub) return;

      const { data: systemAdmin } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .limit(1)
        .maybeSingle();
      if (!systemAdmin) {
        this.logger.error(
          `Webhook overdue: nenhum admin para registeredBy de ${asaasPaymentId}.`,
        );
        return;
      }

      const billingType = paymentData.billingType || 'PIX';
      const localMethod = billingType === 'CREDIT_CARD' ? 'CARD' : 'PIX';
      const amountCentavos = Math.round(Number(paymentData.value || 0) * 100);
      const newId = require('crypto').randomUUID();
      const { error: insErr } = await this.supabase.from('payments').insert({
        id: newId,
        clientId: (linkedSub as any).clientId,
        subscriptionId: (linkedSub as any).id,
        amount: amountCentavos,
        method: localMethod,
        registeredBy: (systemAdmin as any).id,
        notes: `Cobrança recorrente vencida (cobrança ${asaasPaymentId})`,
        asaasPaymentId,
        asaasStatus: AsaasChargeStatus.OVERDUE,
        paidAt: null,
        businessDate: resolveBusinessDate(null, now),
        createdAt: now,
        updatedAt: now,
      });
      if (insErr) {
        this.logger.error(
          `Webhook overdue: falha ao recriar payment para ${asaasPaymentId}: ${insErr.message}`,
        );
        return;
      }
      localPayment = {
        id: newId,
        clientId: (linkedSub as any).clientId,
        amount: amountCentavos,
        subscriptionId: (linkedSub as any).id,
      } as any;
    }

    // Suspender assinatura vinculada
    if (localPayment.subscriptionId) {
      // Buscar nome do plano para descrição da dívida
      const { data: sub } = await this.supabase
        .from('client_subscriptions')
        .select('id, status, plan:subscription_plans!planId(name)')
        .eq('id', localPayment.subscriptionId)
        .single();

      if (sub && ['ACTIVE', 'PENDING_PAYMENT'].includes(sub.status)) {
        await this.supabase
          .from('client_subscriptions')
          .update({ status: 'SUSPENDED', updatedAt: now })
          .eq('id', localPayment.subscriptionId);

        this.logger.log(`Assinatura ${localPayment.subscriptionId} suspensa por falta de pagamento`);
      }

      // Criar dívida para o cliente (inadimplente)
      const planName = (sub?.plan as any)?.name || 'Assinatura';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      // Idempotência: se já existe dívida para este mesmo asaasPaymentId, não duplica.
      const debtTag = `[asaas:${asaasPaymentId}]`;
      const { data: existingDebt } = await this.supabase
        .from('debts')
        .select('id')
        .eq('clientId', localPayment.clientId)
        .ilike('description', `%${debtTag}%`)
        .maybeSingle();

      if (existingDebt) {
        this.logger.log(`Dívida já existente para cobrança ${asaasPaymentId}, ignorando duplicação.`);
        return;
      }

      const { error: debtError } = await this.supabase
        .from('debts')
        .insert({
          id: require('crypto').randomUUID(),
          clientId: localPayment.clientId,
          amount: localPayment.amount,
          amountPaid: 0,
          remainingBalance: localPayment.amount,
          description: `Cobrança não paga — ${planName} ${debtTag}`,
          dueDate: dueDate.toISOString(),
          isSettled: false,
          createdAt: now,
          updatedAt: now,
        });

      if (!debtError) {
        // Marcar cliente como inadimplente
        await this.supabase
          .from('clients')
          .update({ hasDebts: true })
          .eq('id', localPayment.clientId);

        this.logger.log(`Dívida criada para cliente ${localPayment.clientId} — valor: ${localPayment.amount}`);
      } else {
        this.logger.error(`Erro ao criar dívida: ${JSON.stringify(debtError)}`);
      }
    }
  }

  /**
   * Pagamento estornado / estorno em andamento.
   *
   * Estornar é dinheiro SAINDO: o pagamento tem que deixar de contar como receita
   * em TODA tela (caixa, dashboard, relatórios, pote de comissão). As leituras já
   * ignoram asaasStatus de estorno (isRevenuePayment), então o passo central aqui
   * é (1) marcar o status e (2) RECALCULAR o caixa do dia contábil — senão um caixa
   * já FECHADO mantém o valor estornado preso na coluna totalRevenue (a "receita
   * fantasma" que o dono viu: 'só retornei o PIX e entrou no caixa de hoje').
   * Também reverte o lado do agendamento (isPaid + comanda) e da assinatura.
   */
  private async handlePaymentRefunded(paymentData: any) {
    const asaasPaymentId = paymentData.id;

    this.logger.log(`Pagamento estornado: ${asaasPaymentId}`);

    // Buscar pagamento local (inclui businessDate/paidAt p/ saber qual caixa recalcular
    // e subscriptionId p/ suspender a assinatura estornada).
    const { data: localPayment } = await this.supabase
      .from('payments')
      .select('id, appointmentId, subscriptionId, businessDate, paidAt')
      .eq('asaasPaymentId', asaasPaymentId)
      .maybeSingle();

    if (!localPayment) {
      this.logger.warn(
        `Estorno sem pagamento local: ${asaasPaymentId} (externalReference=${paymentData.externalReference || 'n/a'})`,
      );
      return;
    }

    // 1) Marcar o status real do estorno (REFUNDED ou REFUND_IN_PROGRESS). Ambos já
    //    saem da receita via isRevenuePayment — assim que o dono dispara o estorno o
    //    valor some, sem esperar o REFUNDED final.
    const refundedStatus =
      paymentData.status === 'REFUND_IN_PROGRESS'
        ? AsaasChargeStatus.REFUND_IN_PROGRESS
        : AsaasChargeStatus.REFUNDED;
    await this.supabase
      .from('payments')
      .update({ asaasStatus: refundedStatus, updatedAt: nowLocalIsoString() })
      .eq('id', localPayment.id);

    // 2) Recalcular o caixa do DIA CONTÁBIL do pagamento. Para caixa aberto os totais
    //    já são recalculados em tempo real; o problema é o caixa FECHADO, cujos totais
    //    ficam persistidos na coluna. linkPaymentToBusinessDateRegister recalcula
    //    quando o caixa está fechado — exatamente o que tira a receita fantasma de lá.
    const accountingDate: string | null =
      (localPayment as any).businessDate || (localPayment as any).paidAt || null;
    if (accountingDate) {
      try {
        await this.cashRegisterService.linkPaymentToBusinessDateRegister(
          localPayment.id,
          String(accountingDate),
        );
      } catch (e) {
        this.logger.error(
          `Estorno ${asaasPaymentId}: falha ao recalcular caixa do dia ${accountingDate}: ${e}`,
        );
      }
    }

    // 3) Agendamento: reverter pago e a comanda (não é mais receita).
    if (localPayment.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: false, updatedAt: nowLocalIsoString() })
        .eq('id', localPayment.appointmentId);

      // Comanda volta a PENDENTE e desvincula o pagamento estornado.
      await this.supabase
        .from('orders')
        .update({ status: 'PENDING', paymentId: null, updatedAt: nowLocalIsoString() })
        .eq('appointmentId', localPayment.appointmentId)
        .eq('paymentId', localPayment.id);
    }

    // 4) Assinatura: o cliente estornou a mensalidade → suspender o plano. Sem isso a
    //    assinatura seguia ACTIVE após o estorno (cliente devolveu o dinheiro e
    //    continuava usando o plano). Só suspende se ainda estiver ACTIVE/PENDING.
    if (localPayment.subscriptionId) {
      const { data: sub } = await this.supabase
        .from('client_subscriptions')
        .select('status')
        .eq('id', localPayment.subscriptionId)
        .maybeSingle();

      if (sub && ['ACTIVE', 'PENDING_PAYMENT'].includes((sub as any).status)) {
        await this.supabase
          .from('client_subscriptions')
          .update({ status: 'SUSPENDED', updatedAt: nowLocalIsoString() })
          .eq('id', localPayment.subscriptionId);
        this.logger.log(
          `Assinatura ${localPayment.subscriptionId} suspensa por estorno do pagamento ${asaasPaymentId}`,
        );
      }
    }
  }

  /**
   * Pagamento deletado/cancelado
   */
  private async handlePaymentDeleted(paymentData: any) {
    const asaasPaymentId = paymentData.id;

    this.logger.log(`Pagamento deletado no Asaas: ${asaasPaymentId}`);

    await this.supabase
      .from('payments')
      .update({ asaasStatus: 'DELETED' })
      .eq('asaasPaymentId', asaasPaymentId);
  }

  /**
   * Quita a dívida criada por handlePaymentOverdue para o mesmo asaasPaymentId.
   * A correlação é feita pela tag [asaas:<id>] embutida na descrição da dívida.
   * Idempotente: se não há dívida, ou já está quitada, é no-op.
   */
  private async settleOverdueDebtForPayment(clientId: string, asaasPaymentId: string) {
    if (!clientId || !asaasPaymentId) return;
    const tag = `[asaas:${asaasPaymentId}]`;

    let { data: debts } = await this.supabase
      .from('debts')
      .select('id, amount')
      .eq('clientId', clientId)
      .eq('isSettled', false)
      .ilike('description', `%${tag}%`);

    // Fallback para dívidas legadas (sem tag), criadas antes deste fix.
    // Quita todas as dívidas em aberto do cliente cuja descrição começa com "Cobrança não paga"
    // — esse rótulo é exclusivo do fluxo de assinatura inadimplente.
    if (!debts || debts.length === 0) {
      const { data: legacy } = await this.supabase
        .from('debts')
        .select('id, amount')
        .eq('clientId', clientId)
        .eq('isSettled', false)
        .ilike('description', 'Cobrança não paga%');
      debts = legacy || [];
    }

    if (!debts || debts.length === 0) return;

    const now = nowLocalIsoString();
    for (const debt of debts) {
      await this.supabase
        .from('debts')
        .update({
          amountPaid: debt.amount,
          remainingBalance: 0,
          isSettled: true,
          paidAt: now,
          updatedAt: now,
        })
        .eq('id', debt.id);
    }

    // Recalcular flag hasDebts: se não restar nenhuma dívida em aberto, limpar.
    const { count } = await this.supabase
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('clientId', clientId)
      .eq('isSettled', false);

    await this.supabase
      .from('clients')
      .update({ hasDebts: (count || 0) > 0 })
      .eq('id', clientId);

    this.logger.log(
      `Dívida(s) de cobrança ${asaasPaymentId} quitada(s) automaticamente após confirmação do pagamento (${debts.length} registro(s)).`,
    );
  }
}
