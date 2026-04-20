import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { StockService } from '../stock/stock.service';
import { AsaasBillingType } from '../asaas/asaas.types';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto, PayOrderDto } from './dto';
import {
  getClientPlanDiscount,
  getActivePromotions,
  getPromoDiscountForService,
  getPromoDiscountForProduct,
  effectiveDiscountPercent,
  applyDiscount,
  type PromotionMatch,
} from '../common/pricing.helper';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
    private readonly stockService: StockService,
  ) {}

  async create(dto: CreateOrderDto) {
    this.logger.log(`Creating order with ${dto.items?.length ?? 0} items`);

    // Desconto da assinatura ativa do cliente + promoções ativas.
    // Entre promoção e assinatura, prevalece o MAIOR desconto por item.
    const planDiscount = await getClientPlanDiscount(this.supabase, dto.clientId);
    const activePromos = planDiscount >= 0 ? await getActivePromotions(this.supabase) : [];

    const resolvedItems: {
      productId: string | null;
      serviceId: string | null;
      quantity: number;
      unitPrice: number;
      itemType: 'PRODUCT' | 'SERVICE';
    }[] = [];

    let totalAmount = 0;

    for (const item of dto.items || []) {
      const quantity = item.quantity || 1;
      const unitPrice = await this.resolveUnitPrice(item, planDiscount, activePromos);
      totalAmount += unitPrice * quantity;
      resolvedItems.push({
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        quantity,
        unitPrice,
        itemType: item.itemType,
      });
    }

    const now = new Date().toISOString();
    const { data: order, error } = await this.supabase
      .from('orders')
      .insert({
        id: randomUUID(),
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        notes: dto.notes,
        totalAmount: totalAmount,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    for (const item of resolvedItems) {
      const { error: itemError } = await this.supabase.from('order_items').insert({
        id: randomUUID(),
        orderId: order.id,
        productId: item.productId,
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
      });

      if (itemError) {
        this.logger.error(`Error inserting order item: ${JSON.stringify(itemError)}`);
        throw itemError;
      }
    }

    return this.findOne(order.id);
  }

  /**
   * Resolve o preço unitário de um item de comanda considerando:
   * - preço base (products.salePrice / services.price) quando o productId/serviceId é informado
   * - desconto da assinatura ativa do cliente (se houver)
   * - desconto de promoção ativa para o item (se houver)
   * Entre promoção e assinatura, prevalece o MAIOR desconto. Se nenhum id for informado,
   * cai de volta para o unitPrice enviado.
   */
  private async resolveUnitPrice(
    item: { productId?: string; serviceId?: string; unitPrice: number; itemType: 'PRODUCT' | 'SERVICE' },
    planDiscount: number,
    activePromos: PromotionMatch[],
  ): Promise<number> {
    let basePrice = item.unitPrice;
    let promoPercent = 0;

    if (item.itemType === 'PRODUCT' && item.productId) {
      const { data: product } = await this.supabase
        .from('products')
        .select('salePrice')
        .eq('id', item.productId)
        .single();
      if (product?.salePrice != null) basePrice = product.salePrice;
      promoPercent = getPromoDiscountForProduct(activePromos, item.productId);
    } else if (item.itemType === 'SERVICE' && item.serviceId) {
      const { data: service } = await this.supabase
        .from('services')
        .select('price')
        .eq('id', item.serviceId)
        .single();
      if (service?.price != null) basePrice = service.price;
      promoPercent = getPromoDiscountForService(activePromos, item.serviceId);
    }

    const percent = effectiveDiscountPercent(promoPercent, planDiscount);
    return applyDiscount(basePrice, percent);
  }

  async findAll(query: QueryOrderDto) {
    let queryBuilder = this.supabase.from('orders').select('*, client:clients(id, name), items:order_items(id, itemType, productId, serviceId, quantity, unitPrice, product:products(id, name), service:services(id, name))');

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
      .select('*, client:clients(id, name), items:order_items(id, itemType, productId, serviceId, quantity, unitPrice, product:products(id, name), service:services(id, name))')
      .eq('id', id)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    return order;
  }

  async findByAppointment(appointmentId: string) {
    const { data: order } = await this.supabase
      .from('orders')
      .select('*, client:clients(id, name), items:order_items(id, itemType, productId, serviceId, quantity, unitPrice, product:products(id, name), service:services(id, name))')
      .eq('appointmentId', appointmentId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    return order;
  }

  async addItem(orderId: string, dto: AddOrderItemDto) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, totalAmount, appointmentId, clientId')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Só é possível adicionar itens a comandas pendentes');
    }

    // Aplica desconto da assinatura do cliente + promoção ativa (o MAIOR vence).
    const planDiscount = await getClientPlanDiscount(this.supabase, order.clientId);
    const activePromos = await getActivePromotions(this.supabase);
    const unitPrice = await this.resolveUnitPrice(dto, planDiscount, activePromos);
    const quantity = dto.quantity || 1;
    const lineTotal = unitPrice * quantity;

    const { error: insertError } = await this.supabase.from('order_items').insert({
      id: randomUUID(),
      orderId: orderId,
      productId: dto.productId || null,
      serviceId: dto.serviceId || null,
      quantity,
      unitPrice,
      itemType: dto.itemType,
    });

    if (insertError) {
      this.logger.error(`Error inserting order item: ${JSON.stringify(insertError)}`);
      throw insertError;
    }

    const newTotal = order.totalAmount + lineTotal;

    await this.supabase
      .from('orders')
      .update({ totalAmount: newTotal })
      .eq('id', orderId);

    // Sincronizar agendamento vinculado (totalPrice + totalDuration se for serviço)
    if (order.appointmentId) {
      const updateData: any = { totalPrice: newTotal, updatedAt: new Date().toISOString() };

      if (dto.itemType === 'SERVICE' && dto.serviceId) {
        const { data: svc } = await this.supabase
          .from('services')
          .select('duration')
          .eq('id', dto.serviceId)
          .single();

        if (svc) {
          const { data: appt } = await this.supabase
            .from('appointments')
            .select('totalDuration')
            .eq('id', order.appointmentId)
            .single();

          if (appt) {
            updateData.totalDuration = appt.totalDuration + svc.duration;
          }
        }

        // Vincular serviço ao agendamento (appointment_services)
        await this.supabase.from('appointment_services').insert({
          id: randomUUID(),
          appointmentId: order.appointmentId,
          serviceId: dto.serviceId,
          createdAt: new Date().toISOString(),
        });
      }

      await this.supabase
        .from('appointments')
        .update(updateData)
        .eq('id', order.appointmentId);
    }

    return this.findOne(orderId);
  }

  async removeItem(orderId: string, itemId: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, totalAmount, appointmentId')
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
      .select('id, unitPrice, quantity, orderId, itemType, serviceId')
      .eq('id', itemId)
      .single();

    if (itemError || !item || item.orderId !== orderId) {
      throw new NotFoundException('Item n\u00e3o encontrado nesta comanda');
    }

    const lineTotal = item.unitPrice * item.quantity;
    const newTotal = order.totalAmount - lineTotal;

    await this.supabase.from('order_items').delete().eq('id', itemId);

    await this.supabase
      .from('orders')
      .update({ totalAmount: newTotal })
      .eq('id', orderId);

    // Sincronizar agendamento vinculado
    if (order.appointmentId) {
      const updateData: any = { totalPrice: newTotal, updatedAt: new Date().toISOString() };

      if (item.itemType === 'SERVICE' && item.serviceId) {
        const { data: svc } = await this.supabase
          .from('services')
          .select('duration')
          .eq('id', item.serviceId)
          .single();

        if (svc) {
          const { data: appt } = await this.supabase
            .from('appointments')
            .select('totalDuration')
            .eq('id', order.appointmentId)
            .single();

          if (appt) {
            updateData.totalDuration = Math.max(0, appt.totalDuration - svc.duration);
          }
        }

        // Remover vínculo do serviço com o agendamento
        await this.supabase
          .from('appointment_services')
          .delete()
          .eq('appointmentId', order.appointmentId)
          .eq('serviceId', item.serviceId);
      }

      await this.supabase
        .from('appointments')
        .update(updateData)
        .eq('id', order.appointmentId);
    }
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

    // Se a comanda está vinculada a um agendamento já pago, bloquear pagamento duplicado
    if ((order as any).appointmentId) {
      const { data: linkedAppt } = await this.supabase
        .from('appointments')
        .select('id, isPaid')
        .eq('id', (order as any).appointmentId)
        .single();

      if (linkedAppt?.isPaid) {
        throw new BadRequestException('O agendamento vinculado a esta comanda j\u00e1 est\u00e1 pago');
      }
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
    const payNow = new Date().toISOString();
    const productItems = (order.items || []).filter((i: any) => i.itemType === 'PRODUCT' && i.productId);
    for (const item of productItems) {
      try {
        await this.stockService.create({
          productId: item.productId,
          type: 'EXIT',
          quantity: item.quantity,
          reason: `Venda via comanda #${order.id.slice(0, 8)}`,
        });
      } catch (err) {
        this.logger.error(`Erro ao dar baixa no estoque do produto ${item.productId}: ${err.message}`);
        throw new BadRequestException(`Erro ao dar baixa no estoque: ${err.message}`);
      }
    }

    // Criar registro de pagamento para contabilizar no caixa
    let paymentId: string | undefined;
    const paymentMethod = dto?.paymentMethod || 'CASH';
    const registeredBy = dto?.registeredBy || order.clientId;

    if (order.clientId) {
      const { data: payment } = await this.supabase
        .from('payments')
        .insert({
          id: randomUUID(),
          clientId: order.clientId,
          amount: order.totalAmount,
          method: paymentMethod,
          paidAt: payNow,
          registeredBy: registeredBy,
          notes: `Pagamento comanda #${order.id.slice(0, 8)}`,
          createdAt: payNow,
          updatedAt: payNow,
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

    // Se a comanda está vinculada a um agendamento, marcar agendamento como pago
    if ((order as any).appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: true, updatedAt: payNow })
        .eq('id', (order as any).appointmentId);
    }

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
      CREDIT_CARD: 'CARD',
    };

    const asaasNow = new Date().toISOString();
    const { data: payment } = await this.supabase
      .from('payments')
      .insert({
        id: randomUUID(),
        clientId: order.clientId,
        amount: order.totalAmount,
        method: paymentMethodMap[dto.billingType!] || 'PIX',
        paidAt: asaasNow,
        registeredBy: dto.registeredBy || order.clientId,
        notes: `Cobrança Asaas #${asaasCharge.id} - Comanda #${order.id.slice(0, 8)}`,
        asaasPaymentId: asaasCharge.id,
        asaasStatus: asaasCharge.status,
        billingType: dto.billingType,
        invoiceUrl: asaasCharge.invoiceUrl || null,
        bankSlipUrl: asaasCharge.bankSlipUrl || null,
        createdAt: asaasNow,
        updatedAt: asaasNow,
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
      try {
        await this.stockService.create({
          productId: item.productId,
          type: 'EXIT',
          quantity: item.quantity,
          reason: `Venda via comanda #${order.id.slice(0, 8)} (Asaas)`,
        });
      } catch (err) {
        this.logger.error(`Erro ao dar baixa no estoque do produto ${item.productId}: ${err.message}`);
      }
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
