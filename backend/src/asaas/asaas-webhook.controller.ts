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
import { AsaasService } from './asaas.service';
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

    // Fallback: se o payments local sumiu, mas o webhook traz externalReference apontando
    // para uma assinatura existente, recria o registro local antes de seguir.
    // Cobre o caso "cliente pagou PIX, Asaas confirmou, payments local nunca foi inserido
    // por race condition / falha de DB".
    if (!localPayment) {
      const externalRef: string | undefined = paymentData.externalReference;
      if (externalRef) {
        const { data: linkedSub } = await this.supabase
          .from('client_subscriptions')
          .select('id, clientId')
          .eq('id', externalRef)
          .maybeSingle();

        if (linkedSub) {
          const billingType = paymentData.billingType || 'PIX';
          const localMethod = billingType === 'CREDIT_CARD' ? 'CARD' : 'PIX';
          const valueReais = Number(paymentData.value || 0);
          const amountCentavos = Math.round(valueReais * 100);
          const now = new Date().toISOString();
          const newId = require('crypto').randomUUID();

          const { error: insertError } = await this.supabase
            .from('payments')
            .insert({
              id: newId,
              clientId: linkedSub.clientId,
              subscriptionId: linkedSub.id,
              amount: amountCentavos,
              method: localMethod,
              registeredBy: linkedSub.clientId,
              notes: `Reconciliação webhook (cobrança ${asaasPaymentId})`,
              asaasPaymentId,
              asaasStatus: status,
              paidAt: null,
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
            paidAt: null,
            notes: `Reconciliação webhook (cobrança ${asaasPaymentId})`,
          };
        }
      }
    }

    if (!localPayment) {
      this.logger.warn(
        `Pagamento local não encontrado para Asaas ID: ${asaasPaymentId} (externalReference=${paymentData.externalReference || 'n/a'})`,
      );
      return;
    }

    // Idempotência: se já foi confirmado/recebido, não processar novamente
    if (localPayment.paidAt && (localPayment.asaasStatus === 'RECEIVED' || localPayment.asaasStatus === 'CONFIRMED')) {
      this.logger.log(`Webhook duplicado ignorado: ${asaasPaymentId} já processado (${localPayment.asaasStatus})`);
      return;
    }

    // Atualizar status do pagamento
    await this.supabase
      .from('payments')
      .update({
        asaasStatus: status,
        paidAt: new Date().toISOString(),
      })
      .eq('id', localPayment.id);

    // Se vinculado a agendamento, marcar como pago e confirmar se estava pendente
    if (localPayment.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: true, updatedAt: new Date().toISOString() })
        .eq('id', localPayment.appointmentId);

      // Promover PENDING_PAYMENT → SCHEDULED após pagamento confirmado
      await this.supabase
        .from('appointments')
        .update({ status: 'SCHEDULED', updatedAt: new Date().toISOString() })
        .eq('id', localPayment.appointmentId)
        .eq('status', 'PENDING_PAYMENT');

      // Pagar comanda vinculada ao agendamento
      await this.supabase
        .from('orders')
        .update({ status: 'PAID', updatedAt: new Date().toISOString() })
        .eq('appointmentId', localPayment.appointmentId)
        .eq('status', 'PENDING');
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
          .update({ isPaid: true, updatedAt: new Date().toISOString() })
          .eq('id', linkedOrder.appointmentId);

        await this.supabase
          .from('orders')
          .update({ status: 'PAID', updatedAt: new Date().toISOString() })
          .eq('id', linkedOrder.id)
          .eq('status', 'PENDING');
      }
    }

    // Vincular ao caixa aberto (se existir)
    const { data: openRegister } = await this.supabase
      .from('cash_registers')
      .select('id')
      .eq('isOpen', true)
      .single();

    if (openRegister) {
      await this.supabase
        .from('payments')
        .update({ cashRegisterId: openRegister.id })
        .eq('id', localPayment.id);
    }

    // Se vinculado a assinatura, ativar e estender endDate + resetar cortes
    if (localPayment.subscriptionId) {
      const now = new Date();

      // Buscar endDate atual para estender 1 mês (mantém o dia de cobrança)
      const { data: currentSub } = await this.supabase
        .from('client_subscriptions')
        .select('endDate')
        .eq('id', localPayment.subscriptionId)
        .single();

      const currentEnd = currentSub?.endDate ? new Date(currentSub.endDate) : now;
      // Se endDate já passou, estende a partir de hoje; senão, estende a partir do endDate atual
      const baseDate = currentEnd < now ? now : currentEnd;
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
    }

    // Se for pagamento de dívida, quitar dívidas apenas se o valor pago cobre o total pendente
    if (localPayment.notes === 'DEBT_PAYMENT' && localPayment.clientId) {
      const debtNow = new Date().toISOString();

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

    // Buscar pagamento local com dados do cliente
    const { data: localPayment } = await this.supabase
      .from('payments')
      .select('id, clientId, amount, subscriptionId')
      .eq('asaasPaymentId', asaasPaymentId)
      .single();

    if (!localPayment) return;

    const now = new Date().toISOString();

    // Suspender assinatura vinculada
    if (localPayment.subscriptionId) {
      // Buscar nome do plano para descrição da dívida
      const { data: sub } = await this.supabase
        .from('client_subscriptions')
        .select('id, status, plan:subscription_plans(name)')
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

      const { error: debtError } = await this.supabase
        .from('debts')
        .insert({
          id: require('crypto').randomUUID(),
          clientId: localPayment.clientId,
          amount: localPayment.amount,
          amountPaid: 0,
          remainingBalance: localPayment.amount,
          description: `Cobrança não paga — ${planName}`,
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
   * Pagamento estornado
   */
  private async handlePaymentRefunded(paymentData: any) {
    const asaasPaymentId = paymentData.id;

    this.logger.log(`Pagamento estornado: ${asaasPaymentId}`);

    // Buscar pagamento local
    const { data: localPayment } = await this.supabase
      .from('payments')
      .select('id, appointmentId')
      .eq('asaasPaymentId', asaasPaymentId)
      .single();

    if (!localPayment) return;

    // Atualizar status
    await this.supabase
      .from('payments')
      .update({ asaasStatus: AsaasChargeStatus.REFUNDED })
      .eq('id', localPayment.id);

    // Se vinculado a agendamento, reverter isPaid
    if (localPayment.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: false })
        .eq('id', localPayment.appointmentId);
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
}
