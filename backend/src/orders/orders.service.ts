import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto, PayOrderDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateOrderDto) {
    let totalAmount = 0;

    for (const item of dto.items || []) {
      const lineTotal = item.unitPrice * (item.quantity || 1);
      totalAmount += lineTotal;
    }

    const { data: order, error } = await this.supabase
      .from('orders')
      .insert({
        client_id: dto.clientId,
        professional_id: dto.professionalId,
        branch_id: dto.branchId,
        notes: dto.notes,
        total_amount: totalAmount,
        status: 'PENDING',
      })
      .select('*')
      .single();

    if (error) throw error;

    for (const item of dto.items || []) {
      await this.supabase.from('order_items').insert({
        order_id: order.id,
        product_id: item.productId,
        service_id: item.serviceId,
        quantity: item.quantity || 1,
        unit_price: item.unitPrice,
        item_type: item.itemType,
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
      queryBuilder = queryBuilder.eq('branch_id', query.branchId);
    }

    if (query.clientId) {
      queryBuilder = queryBuilder.eq('client_id', query.clientId);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('created_at', new Date(query.startDate).toISOString());
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('created_at', new Date(query.endDate + 'T23:59:59.999Z').toISOString());
    }

    const { data: orders, error } = await queryBuilder.order('created_at', { ascending: false });

    if (error) throw error;
    return orders || [];
  }

  async findPending() {
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

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
      .eq('order_id', id);

    return { ...order, items: items || [] };
  }

  async addItem(orderId: string, dto: AddOrderItemDto) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, total_amount')
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
      order_id: orderId,
      product_id: dto.productId,
      service_id: dto.serviceId,
      quantity: dto.quantity || 1,
      unit_price: dto.unitPrice,
      item_type: dto.itemType,
    });

    await this.supabase
      .from('orders')
      .update({ total_amount: order.total_amount + lineTotal })
      .eq('id', orderId);

    return this.findOne(orderId);
  }

  async removeItem(orderId: string, itemId: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, total_amount')
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
      .select('id, unit_price, quantity, order_id')
      .eq('id', itemId)
      .single();

    if (itemError || !item || item.order_id !== orderId) {
      throw new NotFoundException('Item não encontrado nesta comanda');
    }

    const lineTotal = item.unit_price * item.quantity;

    await this.supabase.from('order_items').delete().eq('id', itemId);

    await this.supabase
      .from('orders')
      .update({ total_amount: order.total_amount - lineTotal })
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

    // Baixa no estoque para produtos
    const productItems = (order.items || []).filter((i: any) => i.item_type === 'PRODUCT' && i.product_id);
    for (const item of productItems) {
      await this.supabase.from('stock_movements').insert({
        product_id: item.product_id,
        type: 'EXIT',
        quantity: item.quantity,
        reason: `Venda via comanda #${order.id.slice(0, 8)}`,
      });
    }

    // Criar pagamento se método informado
    let paymentId: string | undefined;
    if (dto?.paymentMethod && order.client_id) {
      const { data: payment } = await this.supabase
        .from('payments')
        .insert({
          client_id: order.client_id,
          amount: order.total_amount,
          method: dto.paymentMethod,
          paid_at: new Date().toISOString(),
          registered_by: dto.registeredBy || order.client_id,
          notes: `Pagamento comanda #${order.id.slice(0, 8)}`,
        })
        .select('id')
        .single();

      paymentId = payment?.id;

      // Vincular ao caixa aberto
      const { data: openRegister } = await this.supabase
        .from('cash_registers')
        .select('id')
        .eq('is_open', true)
        .single();

      if (openRegister && paymentId) {
        await this.supabase
          .from('payments')
          .update({ cash_register_id: openRegister.id })
          .eq('id', paymentId);
      }
    }

    // Atualizar status
    await this.supabase
      .from('orders')
      .update({ status: 'PAID', payment_id: paymentId })
      .eq('id', id);

    return this.findOne(id);
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

    await this.supabase.from('order_items').delete().eq('order_id', id);
    await this.supabase.from('orders').delete().eq('id', id);
  }
}
