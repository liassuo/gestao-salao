import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AsaasService } from './asaas.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateChargeDto } from './dto';
import { AsaasBillingType } from './asaas.types';

@ApiTags('Asaas')
@Controller('asaas')
export class AsaasController {
  constructor(
    private readonly asaasService: AsaasService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('charges')
  @ApiOperation({ summary: 'Criar cobrança no Asaas (PIX, Boleto ou Cartão)' })
  @ApiResponse({ status: 201, description: 'Cobrança criada com sucesso' })
  @HttpCode(HttpStatus.CREATED)
  async createCharge(@Body() dto: CreateChargeDto) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada');
    }

    // Buscar cliente e verificar se tem asaasCustomerId
    const { data: client, error: clientError } = await this.supabase
      .from('clients')
      .select('id, name, email, phone, asaasCustomerId')
      .eq('id', dto.clientId)
      .single();

    if (clientError || !client) {
      throw new BadRequestException('Cliente não encontrado');
    }

    // Se cliente não tem asaasCustomerId, criar no Asaas primeiro
    let asaasCustomerId = client.asaasCustomerId;
    if (!asaasCustomerId) {
      const asaasCustomer = await this.asaasService.createCustomer({
        name: client.name,
        email: client.email || undefined,
        mobilePhone: client.phone || undefined,
        externalReference: client.id,
      });
      asaasCustomerId = asaasCustomer.id;

      // Salvar asaasCustomerId no cliente local
      await this.supabase
        .from('clients')
        .update({ asaasCustomerId })
        .eq('id', client.id);
    }

    // Criar cobrança no Asaas
    const asaasCharge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: dto.billingType,
      value: this.asaasService.centavosToReais(dto.value),
      dueDate: dto.dueDate,
      description: dto.description,
      externalReference: dto.externalReference || dto.appointmentId || dto.orderId,
    });

    // Criar registro de pagamento local com status pendente
    const paymentData: Record<string, any> = {
      clientId: dto.clientId,
      amount: dto.value,
      method: this.billingTypeToPaymentMethod(dto.billingType),
      paidAt: new Date().toISOString(),
      registeredBy: dto.clientId, // auto-gerado
      notes: `Cobrança Asaas #${asaasCharge.id} - ${dto.description || ''}`,
      asaasPaymentId: asaasCharge.id,
      asaasStatus: asaasCharge.status,
      billingType: dto.billingType,
      invoiceUrl: asaasCharge.invoiceUrl || null,
      bankSlipUrl: asaasCharge.bankSlipUrl || null,
    };

    if (dto.appointmentId) {
      paymentData.appointmentId = dto.appointmentId;
    }

    const { data: payment, error: payError } = await this.supabase
      .from('payments')
      .insert(paymentData)
      .select('*')
      .single();

    if (payError) throw payError;

    // Se for PIX, buscar QR Code
    let pixQrCode = null;
    if (dto.billingType === AsaasBillingType.PIX) {
      try {
        pixQrCode = await this.asaasService.getPixQrCode(asaasCharge.id);

        // Salvar QR Code no pagamento
        await this.supabase
          .from('payments')
          .update({
            pixQrCodeBase64: pixQrCode.encodedImage,
            pixCopyPaste: pixQrCode.payload,
          })
          .eq('id', payment.id);
      } catch {
        // QR Code pode não estar disponível imediatamente
      }
    }

    // Se vinculado a comanda, atualizar paymentId
    if (dto.orderId) {
      await this.supabase
        .from('orders')
        .update({ paymentId: payment.id })
        .eq('id', dto.orderId);
    }

    return {
      payment,
      asaasCharge,
      pixQrCode,
    };
  }

  @Get('charges/:id')
  @ApiOperation({ summary: 'Consultar cobrança no Asaas' })
  async getCharge(@Param('id') asaasPaymentId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada');
    }
    return this.asaasService.getCharge(asaasPaymentId);
  }

  @Get('charges/:id/pix-qrcode')
  @ApiOperation({ summary: 'Obter QR Code PIX da cobrança' })
  async getPixQrCode(@Param('id') asaasPaymentId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada');
    }
    return this.asaasService.getPixQrCode(asaasPaymentId);
  }

  @Delete('charges/:id')
  @ApiOperation({ summary: 'Cancelar cobrança no Asaas' })
  @HttpCode(HttpStatus.OK)
  async cancelCharge(@Param('id') asaasPaymentId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada');
    }

    const result = await this.asaasService.cancelCharge(asaasPaymentId);

    // Atualizar status local
    await this.supabase
      .from('payments')
      .update({ asaasStatus: 'CANCELED' })
      .eq('asaasPaymentId', asaasPaymentId);

    return result;
  }

  @Post('sync-customer/:clientId')
  @ApiOperation({ summary: 'Sincronizar cliente com Asaas (criar ou atualizar)' })
  async syncCustomer(@Param('clientId') clientId: string) {
    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração Asaas não está configurada');
    }

    const { data: client, error } = await this.supabase
      .from('clients')
      .select('id, name, email, phone, asaasCustomerId')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      throw new BadRequestException('Cliente não encontrado');
    }

    const payload = {
      name: client.name,
      email: client.email || undefined,
      mobilePhone: client.phone || undefined,
      externalReference: client.id,
    };

    let asaasCustomer;
    if (client.asaasCustomerId) {
      asaasCustomer = await this.asaasService.updateCustomer(
        client.asaasCustomerId,
        payload,
      );
    } else {
      asaasCustomer = await this.asaasService.createCustomer(payload);
      await this.supabase
        .from('clients')
        .update({ asaasCustomerId: asaasCustomer.id })
        .eq('id', client.id);
    }

    return { client, asaasCustomer };
  }

  private billingTypeToPaymentMethod(billingType: AsaasBillingType): string {
    switch (billingType) {
      case AsaasBillingType.PIX:
        return 'PIX';
      case AsaasBillingType.BOLETO:
        return 'BOLETO';
      case AsaasBillingType.CREDIT_CARD:
        return 'CARD';
      default:
        return 'PIX';
    }
  }
}
