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
    const { data: localPayment } = await this.supabase
      .from('payments')
      .select('id, appointmentId, clientId, amount, subscriptionId, asaasStatus, paidAt, notes')
      .eq('asaasPaymentId', asaasPaymentId)
      .single();

    if (!localPayment) {
      this.logger.warn(
        `Pagamento local não encontrado para Asaas ID: ${asaasPaymentId}`,
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

    // Suspender assinatura vinculada
    const { data: localPayment } = await this.supabase
      .from('payments')
      .select('subscriptionId')
      .eq('asaasPaymentId', asaasPaymentId)
      .single();

    if (localPayment?.subscriptionId) {
      const now = new Date().toISOString();
      await this.supabase
        .from('client_subscriptions')
        .update({ status: 'SUSPENDED', updatedAt: now })
        .eq('id', localPayment.subscriptionId)
        .in('status', ['ACTIVE', 'PENDING_PAYMENT']);

      this.logger.log(`Assinatura ${localPayment.subscriptionId} suspensa por falta de pagamento`);
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
