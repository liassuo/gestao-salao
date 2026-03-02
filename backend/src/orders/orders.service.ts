import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { AsaasBillingType } from '../asaas/asaas.types';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto, PayOrderDto } from './dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
  ) {}

  async create(dto: CreateOrderDto) {
    let totalAmount = 0;

    for (const item of dto.items || []) {
      const lineTotal = item.unitPrice * (item.quantity || 1);
      totalAmount += lineTotal;
    }

    const { data: order, error } = await this.supabase
      .from('orders')
      .insert({
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        notes: dto.notes,
        totalAmount: totalAmount,
        status: 'PENDING',
      })
      .select('*')
      .single();

    if (error) throw error;

    for (const item of dto.items || []) {
      await this.supabase.from('order_items').insert({
        orderId: order.id,
        productId: item.productId,
        serviceId: item.serviceId,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
      });
    }

    return order;
  }

  async findAll(query: QueryOrderDto) {
    let queryBuilder = this.supabase.from('orders').select('*');

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.branchId) {
      queryBuilder = queryBuilder.eq('branchId', query.branchId);
    }

    if (query.clientId) {
      queryBuilder = queryBuilder.eq('clientId', query.clientId);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('createdAt', new Date(query.startDate).toISOString());
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('createdAt', new Date(query.endDate + 'T23:59:59.999Z').toISOString());
    }

    const { data: orders, error } = await queryBuilder.order('createdAt', { ascending: false });

    if (error) throw error;
    return orders || [];
  }

  async findOne(id: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    const { data: items } = await this.supabase
      .from('order_items')
      .select('*')
      .eq('orderId', id);

    return { ...order, items: items || [] };
  }

  async addItem(orderId: string, dto: AddOrderItemDto) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, totalAmount')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Só é possível adicionar itens a comandas pendentes');
    }

    const lineTotal = dto.unitPrice * (dto.quantity || 1);

    await this.supabase.from('order_items').insert({
      orderId: orderId,
      productId: dto.productId,
      serviceId: dto.serviceId,
      quantity: dto.quantity || 1,
      unitPrice: dto.unitPrice,
      itemType: dto.itemType,
    });

    await this.supabase
      .from('orders')
      .update({ totalAmount: order.totalAmount + lineTotal })
      .eq('id', orderId);

    return this.findOne(orderId);
  }

  async removeItem(orderId: string, itemId: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, totalAmount')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Só é possível remover itens de comandas pendentes');
    }

    const { data: item, error: itemError } = await this.supabase
      .from('order_items')
      .select('id, unitPrice, quantity, orderId')
      .eq('id', itemId)
      .single();

    if (itemError || !item || item.orderId !== orderId) {
      throw new NotFoundException('Item não encontrado nesta comanda');
    }

    const lineTotal = item.unitPrice * item.quantity;

    await this.supabase.from('order_items').delete().eq('id', itemId);

    await this.supabase
      .from('orders')
      .update({ totalAmount: order.totalAmount - lineTotal })
      .eq('id', orderId);
  }

  async update(id: string, dto: UpdateOrderDto) {
    const { data: order, error: findError } = await this.supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    const { data: updated, error } = await this.supabase
      .from('orders')
      .update(dto)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async pay(id: string, dto?: PayOrderDto) {
    const order = await this.findOne(id);

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Comanda não está pendente');
    }

    // ============================
    // FLUXO ASAAS (cobrança digital)
    // ============================
    if (dto?.billingType && this.asaasService.configured) {
      return this.payWithAsaas(id, order, dto);
    }

    // ============================
    // FLUXO MANUAL (original)
    // ============================

    // Baixa no estoque para produtos
    const productItems = (order.items || []).filter((i: any) => i.itemType === 'PRODUCT' && i.productId);
    for (const item of productItems) {
      await this.supabase.from('stock_movements').insert({
        productId: item.productId,
        type: 'EXIT',
        quantity: item.quantity,
        reason: `Venda via comanda #${order.id.slice(0, 8)}`,
      });
    }

    // Criar pagamento se método informado
    let paymentId: string | undefined;
    if (dto?.paymentMethod && order.clientId) {
      const { data: payment } = await this.supabase
        .from('payments')
        .insert({
          clientId: order.clientId,
          amount: order.totalAmount,
          method: dto.paymentMethod,
          paidAt: new Date().toISOString(),
          registeredBy: dto.registeredBy || order.clientId,
          notes: `Pagamento comanda #${order.id.slice(0, 8)}`,
        })
        .select('id')
        .single();

      paymentId = payment?.id;

      // Vincular ao caixa aberto
      const { data: openRegister } = await this.supabase
        .from('cash_registers')
        .select('id')
        .eq('isOpen', true)
        .single();

      if (openRegister && paymentId) {
        await this.supabase
          .from('payments')
          .update({ cashRegisterId: openRegister.id })
          .eq('id', paymentId);
      }
    }

    // Atualizar status
    await this.supabase
      .from('orders')
      .update({ status: 'PAID', paymentId: paymentId })
      .eq('id', id);

    return this.findOne(id);
  }

  /**
   * Pagar comanda via Asaas (cobrança digital)
   * O pagamento só será confirmado via webhook.
   */
  private async payWithAsaas(id: string, order: any, dto: PayOrderDto) {
    if (!order.clientId) {
      throw new BadRequestException('Comanda precisa ter um cliente para cobrança digital');
    }

    // Buscar cliente com asaasCustomerId
    const { data: client } = await this.supabase
      .from('clients')
      .select('id, name, email, phone, asaasCustomerId')
      .eq('id', order.clientId)
      .single();

    if (!client) {
      throw new BadRequestException('Cliente não encontrado');
    }

    // Criar customer no Asaas se necessário
    let asaasCustomerId = client.asaasCustomerId;
    if (!asaasCustomerId) {
      const asaasCustomer = await this.asaasService.createCustomer({
        name: client.name,
        email: client.email || undefined,
        mobilePhone: client.phone || undefined,
        externalReference: client.id,
      });
      asaasCustomerId = asaasCustomer.id;
      await this.supabase
        .from('clients')
        .update({ asaasCustomerId })
        .eq('id', client.id);
    }

    // Criar cobrança no Asaas
    const billingType = dto.billingType as unknown as AsaasBillingType;
    const dueDate = dto.dueDate || new Date().toISOString().split('T')[0];

    const asaasCharge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType,
      value: this.asaasService.centavosToReais(order.totalAmount),
      dueDate,
      description: `Comanda #${order.id.slice(0, 8)}`,
      externalReference: order.id,
    });

    // Criar registro de pagamento local (pendente)
    const paymentMethodMap: Record<string, string> = {
      PIX: 'PIX',
      BOLETO: 'BOLETO',
      CREDIT_CARD: 'CARD',
    };

    const { data: payment } = await this.supabase
      .from('payments')
      .insert({
        clientId: order.clientId,
        amount: order.totalAmount,
        method: paymentMethodMap[dto.billingType!] || 'PIX',
        paidAt: new Date().toISOString(),
        registeredBy: dto.registeredBy || order.clientId,
        notes: `Cobrança Asaas #${asaasCharge.id} - Comanda #${order.id.slice(0, 8)}`,
        asaasPaymentId: asaasCharge.id,
        asaasStatus: asaasCharge.status,
        billingType: dto.billingType,
        invoiceUrl: asaasCharge.invoiceUrl || null,
        bankSlipUrl: asaasCharge.bankSlipUrl || null,
      })
      .select('id')
      .single();

    // Buscar QR Code PIX se aplicável
    let pixQrCode = null;
    if (dto.billingType === 'PIX' && payment) {
      try {
        pixQrCode = await this.asaasService.getPixQrCode(asaasCharge.id);
        await this.supabase
          .from('payments')
          .update({
            pixQrCodeBase64: pixQrCode.encodedImage,
            pixCopyPaste: pixQrCode.payload,
          })
          .eq('id', payment.id);
      } catch {
        this.logger.warn('QR Code PIX não disponível imediatamente');
      }
    }

    // Atualizar comanda com paymentId (status fica PENDING até webhook confirmar)
    await this.supabase
      .from('orders')
      .update({ paymentId: payment?.id })
      .eq('id', id);

    // Baixa no estoque
    const productItems = (order.items || []).filter((i: any) => i.itemType === 'PRODUCT' && i.productId);
    for (const item of productItems) {
      await this.supabase.from('stock_movements').insert({
        productId: item.productId,
        type: 'EXIT',
        quantity: item.quantity,
        reason: `Venda via comanda #${order.id.slice(0, 8)} (Asaas)`,
      });
    }

    return {
      order: await this.findOne(id),
      asaasCharge,
      pixQrCode,
    };
  }

  async cancel(id: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Comanda não está pendente');
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('orders')
      .update({ status: 'CANCELED' })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async remove(id: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    await this.supabase.from('order_items').delete().eq('orderId', id);
    await this.supabase.from('orders').delete().eq('id', id);
  }
}
