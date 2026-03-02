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

@ApiTags('Webhooks')
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
      .select('id, appointmentId, clientId, amount')
      .eq('asaasPaymentId', asaasPaymentId)
      .single();

    if (!localPayment) {
      this.logger.warn(
        `Pagamento local não encontrado para Asaas ID: ${asaasPaymentId}`,
      );
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

    // Se vinculado a agendamento, marcar como pago
    if (localPayment.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: true })
        .eq('id', localPayment.appointmentId);
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

    this.logger.log(
      `Pagamento local ${localPayment.id} atualizado como confirmado`,
    );
  }

  /**
   * Pagamento vencido
   */
  private async handlePaymentOverdue(paymentData: any) {
    const asaasPaymentId = paymentData.id;

    this.logger.log(`Pagamento vencido: ${asaasPaymentId}`);

    await this.supabase
      .from('payments')
      .update({ asaasStatus: AsaasChargeStatus.OVERDUE })
      .eq('asaasPaymentId', asaasPaymentId);
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
