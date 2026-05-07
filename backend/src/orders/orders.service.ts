import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { nowLocalIsoString } from '../common/datetime.util';
import { AsaasService } from '../asaas/asaas.service';
import { StockService } from '../stock/stock.service';
import { ProfessionalDebtsService } from '../professional-debts/professional-debts.service';
import { AsaasBillingType } from '../asaas/asaas.types';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto, PayOrderDto } from './dto';
import {
  getActiveClientSubscription,
  getPlanDiscountForService,
  getActivePromotions,
  getPromoDiscountForService,
  getPromoDiscountForProduct,
  effectiveDiscountPercent,
  applyDiscount,
  getRemainingCuts,
  isPlanIncludedService,
  type PromotionMatch,
  type ActiveClientSubscription,
} from '../common/pricing.helper';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
    private readonly stockService: StockService,
    private readonly professionalDebtsService: ProfessionalDebtsService,
  ) {}

  async create(dto: CreateOrderDto) {
    this.logger.log(`Creating order with ${dto.items?.length ?? 0} items`);

    // Plano ativo do cliente (com desconto por serviço + saldo de cortes) + promoções.
    // Regras: (a) entre promoção e plano, prevalece o MAIOR desconto por item;
    // (b) serviço com override 100% = "incluído no plano" — zera o preço e debita
    // 1 corte do `cutsUsedThisMonth`; quando o saldo acaba, cai no `discountPercent`
    // global do plano (cobra naturalmente).
    const activeSub = await getActiveClientSubscription(this.supabase, dto.clientId);
    const activePromos = await getActivePromotions(this.supabase);

    // Saldo simulado: vai sendo decrementado item-a-item antes de persistir o débito.
    let remainingCuts = getRemainingCuts(activeSub);

    const resolvedItems: {
      productId: string | null;
      serviceId: string | null;
      quantity: number;
      unitPrice: number;
      itemType: 'PRODUCT' | 'SERVICE';
      consumedSubscriptionCut: boolean;
    }[] = [];

    let totalAmount = 0;
    let cutsToDebit = 0;

    // Para cada item da entrada, expandimos por quantidade quando for serviço incluído
    // no plano — porque cada unidade pode ter destino diferente (a 1ª e 2ª consomem
    // crédito, a 3ª já não tem saldo e cai no fallback). Para o caso comum (qty=1
    // ou item que não consome corte), continua como uma linha só.
    for (const item of dto.items || []) {
      const quantity = item.quantity || 1;
      const isPlanCut =
        item.itemType === 'SERVICE' &&
        !!item.serviceId &&
        isPlanIncludedService(activeSub, item.serviceId);

      if (isPlanCut && quantity > 1) {
        for (let i = 0; i < quantity; i++) {
          const { unitPrice, consumedCut } = await this.resolveItemPrice(
            item,
            activeSub,
            remainingCuts,
            activePromos,
          );
          if (consumedCut) {
            remainingCuts -= 1;
            cutsToDebit += 1;
          }
          totalAmount += unitPrice;
          resolvedItems.push({
            productId: item.productId || null,
            serviceId: item.serviceId || null,
            quantity: 1,
            unitPrice,
            itemType: item.itemType,
            consumedSubscriptionCut: consumedCut,
          });
        }
      } else {
        const { unitPrice, consumedCut } = await this.resolveItemPrice(
          item,
          activeSub,
          remainingCuts,
          activePromos,
        );
        if (consumedCut) {
          remainingCuts -= 1;
          cutsToDebit += 1;
        }
        totalAmount += unitPrice * quantity;
        resolvedItems.push({
          productId: item.productId || null,
          serviceId: item.serviceId || null,
          quantity,
          unitPrice,
          itemType: item.itemType,
          consumedSubscriptionCut: consumedCut,
        });
      }
    }

    const consumerType = dto.consumerType || 'CLIENT';
    if (consumerType === 'PROFESSIONAL' && !dto.consumerProfessionalId) {
      throw new BadRequestException(
        'consumerProfessionalId é obrigatório quando consumerType=PROFESSIONAL',
      );
    }
    // Comanda de cliente sem clientId é dado órfão: não dá pra registrar
    // pagamento corretamente no caixa nem cruzar com agendamento depois.
    if (consumerType === 'CLIENT' && !dto.clientId) {
      throw new BadRequestException(
        'clientId é obrigatório para comandas de cliente (consumerType=CLIENT)',
      );
    }

    const now = nowLocalIsoString();
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
        consumerType,
        consumerProfessionalId:
          consumerType === 'PROFESSIONAL' ? dto.consumerProfessionalId : null,
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
        consumedSubscriptionCut: item.consumedSubscriptionCut,
      });

      if (itemError) {
        this.logger.error(`Error inserting order item: ${JSON.stringify(itemError)}`);
        throw itemError;
      }
    }

    // Debita os créditos da assinatura uma só vez (não por item) pra reduzir
    // round-trips e manter o contador consistente com o nº de linhas marcadas.
    if (cutsToDebit > 0 && activeSub) {
      await this.debitSubscriptionCuts(activeSub.subscriptionId, cutsToDebit);
    }

    return this.findOne(order.id);
  }

  /**
   * Resolve o preço unitário de UMA UNIDADE de item de comanda considerando:
   * - preço base (products.salePrice / services.price) quando o productId/serviceId é informado;
   * - serviço incluído no plano (override 100%) com saldo disponível → preço 0 e
   *   marca consumedCut=true (1 corte do `cutsUsedThisMonth` será debitado);
   * - serviço incluído no plano sem saldo → cai no `discountPercent` global do plano
   *   (fallback "natural": cobra com desconto residual ou cheio se global=0);
   * - demais casos: aplica o MAIOR entre promoção ativa e desconto do plano (override
   *   por serviço ou global).
   *
   * Se nenhum id for informado, cai de volta para o unitPrice enviado pelo caller.
   */
  private async resolveItemPrice(
    item: { productId?: string; serviceId?: string; unitPrice: number; itemType: 'PRODUCT' | 'SERVICE' },
    sub: ActiveClientSubscription | null,
    remainingCuts: number,
    activePromos: PromotionMatch[],
  ): Promise<{ unitPrice: number; consumedCut: boolean }> {
    let basePrice = item.unitPrice;
    let promoPercent = 0;
    let planPercent = 0;

    if (item.itemType === 'PRODUCT' && item.productId) {
      const { data: product } = await this.supabase
        .from('products')
        .select('salePrice')
        .eq('id', item.productId)
        .single();
      if (product?.salePrice != null) basePrice = product.salePrice;
      promoPercent = getPromoDiscountForProduct(activePromos, item.productId);
      // Produtos não têm override por serviço — usa desconto global do plano.
      planPercent = sub?.globalPercent ?? 0;
    } else if (item.itemType === 'SERVICE' && item.serviceId) {
      const { data: service } = await this.supabase
        .from('services')
        .select('price')
        .eq('id', item.serviceId)
        .single();
      if (service?.price != null) basePrice = service.price;
      promoPercent = getPromoDiscountForService(activePromos, item.serviceId);

      // Serviço incluído no plano: tenta consumir crédito; se não há saldo, cai
      // no desconto global (fallback natural — cobra normalmente).
      if (sub && isPlanIncludedService(sub, item.serviceId)) {
        if (remainingCuts > 0) {
          return { unitPrice: 0, consumedCut: true };
        }
        planPercent = sub.globalPercent;
      } else {
        planPercent = getPlanDiscountForService(sub, item.serviceId);
      }
    }

    const percent = effectiveDiscountPercent(promoPercent, planPercent);
    return { unitPrice: applyDiscount(basePrice, percent), consumedCut: false };
  }

  /**
   * Débito atômico de cortes da assinatura via RPC PostgreSQL
   * (`debit_subscription_cuts(sub_id, amount)`). O UPDATE incremental dentro da
   * função usa row lock automático do Postgres — duas chamadas concorrentes ficam
   * serializadas, sem perder débitos.
   *
   * Fallback: se a RPC ainda não existe (migration não aplicada), cai num
   * read-modify-write — não dá erro, só fica vulnerável a race em concorrência
   * simultânea (cenário raro para uma comanda de salão).
   */
  private async debitSubscriptionCuts(subscriptionId: string, amount: number) {
    if (amount <= 0) return;
    const { error } = await this.supabase.rpc('debit_subscription_cuts', {
      sub_id: subscriptionId,
      amount,
    });
    if (error) {
      this.logger.warn(
        `RPC debit_subscription_cuts indisponível (${error.message}); usando fallback read-modify-write. ` +
          `Aplique a migration backend/sql/alter_order_items_add_consumed_cut.sql.`,
      );
      await this.debitFallback(subscriptionId, amount);
    }
  }

  private async refundSubscriptionCuts(subscriptionId: string, amount: number) {
    if (amount <= 0) return;
    const { error } = await this.supabase.rpc('refund_subscription_cuts', {
      sub_id: subscriptionId,
      amount,
    });
    if (error) {
      this.logger.warn(
        `RPC refund_subscription_cuts indisponível (${error.message}); usando fallback. ` +
          `Aplique a migration backend/sql/alter_order_items_add_consumed_cut.sql.`,
      );
      await this.refundFallback(subscriptionId, amount);
    }
  }

  /** Fallback não-atômico — só usado se a RPC do Postgres não existir ainda. */
  private async debitFallback(subscriptionId: string, amount: number) {
    const { data: sub } = await this.supabase
      .from('client_subscriptions')
      .select('id, cutsUsedThisMonth')
      .eq('id', subscriptionId)
      .single();
    if (!sub) return;
    const current = typeof sub.cutsUsedThisMonth === 'number' ? sub.cutsUsedThisMonth : 0;
    await this.supabase
      .from('client_subscriptions')
      .update({ cutsUsedThisMonth: current + amount, updatedAt: nowLocalIsoString() })
      .eq('id', subscriptionId);
  }

  private async refundFallback(subscriptionId: string, amount: number) {
    const { data: sub } = await this.supabase
      .from('client_subscriptions')
      .select('id, cutsUsedThisMonth')
      .eq('id', subscriptionId)
      .single();
    if (!sub) return;
    const current = typeof sub.cutsUsedThisMonth === 'number' ? sub.cutsUsedThisMonth : 0;
    const next = Math.max(0, current - amount);
    await this.supabase
      .from('client_subscriptions')
      .update({ cutsUsedThisMonth: next, updatedAt: nowLocalIsoString() })
      .eq('id', subscriptionId);
  }

  async findAll(query: QueryOrderDto) {
    let queryBuilder = this.supabase.from('orders').select('*, client:clients(id, name), consumerProfessional:professionals!consumerProfessionalId(id, name), items:order_items(id, itemType, productId, serviceId, quantity, unitPrice, product:products(id, name), service:services(id, name))');

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
      .select('*, client:clients(id, name), consumerProfessional:professionals!consumerProfessionalId(id, name), items:order_items(id, itemType, productId, serviceId, quantity, unitPrice, product:products(id, name), service:services(id, name))')
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
      .select('*, client:clients(id, name), consumerProfessional:professionals!consumerProfessionalId(id, name), items:order_items(id, itemType, productId, serviceId, quantity, unitPrice, product:products(id, name), service:services(id, name))')
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
    // Para serviço incluído no plano (override 100%), consome créditos disponíveis;
    // se passar do limite, cobra naturalmente pelo discountPercent global do plano.
    const activeSub = await getActiveClientSubscription(this.supabase, order.clientId);
    const activePromos = await getActivePromotions(this.supabase);
    let remainingCuts = getRemainingCuts(activeSub);

    const quantity = dto.quantity || 1;
    const isPlanCut =
      dto.itemType === 'SERVICE' &&
      !!dto.serviceId &&
      isPlanIncludedService(activeSub, dto.serviceId);

    // Linhas a inserir (uma só na maioria dos casos; expande quando o item é
    // do plano e quantity > 1 e parte consome crédito e parte não).
    const linesToInsert: {
      quantity: number;
      unitPrice: number;
      consumedSubscriptionCut: boolean;
    }[] = [];
    let cutsToDebit = 0;
    let lineTotal = 0;

    if (isPlanCut && quantity > 1) {
      for (let i = 0; i < quantity; i++) {
        const { unitPrice, consumedCut } = await this.resolveItemPrice(
          dto,
          activeSub,
          remainingCuts,
          activePromos,
        );
        if (consumedCut) {
          remainingCuts -= 1;
          cutsToDebit += 1;
        }
        linesToInsert.push({ quantity: 1, unitPrice, consumedSubscriptionCut: consumedCut });
        lineTotal += unitPrice;
      }
    } else {
      const { unitPrice, consumedCut } = await this.resolveItemPrice(
        dto,
        activeSub,
        remainingCuts,
        activePromos,
      );
      if (consumedCut) {
        remainingCuts -= 1;
        cutsToDebit += 1;
      }
      linesToInsert.push({ quantity, unitPrice, consumedSubscriptionCut: consumedCut });
      lineTotal = unitPrice * quantity;
    }

    for (const line of linesToInsert) {
      const { error: insertError } = await this.supabase.from('order_items').insert({
        id: randomUUID(),
        orderId: orderId,
        productId: dto.productId || null,
        serviceId: dto.serviceId || null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        itemType: dto.itemType,
        consumedSubscriptionCut: line.consumedSubscriptionCut,
      });

      if (insertError) {
        this.logger.error(`Error inserting order item: ${JSON.stringify(insertError)}`);
        throw insertError;
      }
    }

    if (cutsToDebit > 0 && activeSub) {
      await this.debitSubscriptionCuts(activeSub.subscriptionId, cutsToDebit);
    }

    const newTotal = order.totalAmount + lineTotal;

    await this.supabase
      .from('orders')
      .update({ totalAmount: newTotal })
      .eq('id', orderId);

    // Sincronizar agendamento vinculado (totalPrice + totalDuration se for serviço)
    if (order.appointmentId) {
      const updateData: any = { totalPrice: newTotal, updatedAt: nowLocalIsoString() };

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
          createdAt: nowLocalIsoString(),
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
      .select('id, status, totalAmount, appointmentId, clientId')
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
      .select('id, unitPrice, quantity, orderId, itemType, serviceId, consumedSubscriptionCut')
      .eq('id', itemId)
      .single();

    if (itemError || !item || item.orderId !== orderId) {
      throw new NotFoundException('Item n\u00e3o encontrado nesta comanda');
    }

    const lineTotal = item.unitPrice * item.quantity;
    const newTotal = order.totalAmount - lineTotal;

    await this.supabase.from('order_items').delete().eq('id', itemId);

    // Se este item havia consumido cr\u00e9ditos da assinatura, devolve agora.
    // (1 cr\u00e9dito por unidade marcada \u2014 quantity)
    if ((item as any).consumedSubscriptionCut && (order as any).clientId) {
      const sub = await getActiveClientSubscription(this.supabase, (order as any).clientId);
      if (sub) {
        await this.refundSubscriptionCuts(sub.subscriptionId, item.quantity || 1);
      }
    }

    await this.supabase
      .from('orders')
      .update({ totalAmount: newTotal })
      .eq('id', orderId);

    // Sincronizar agendamento vinculado
    if (order.appointmentId) {
      const updateData: any = { totalPrice: newTotal, updatedAt: nowLocalIsoString() };

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
    // FLUXO DÉBITO DO PROFISSIONAL
    // (consumo do barbeiro: não entra no caixa, vira saldo a deduzir na comissão)
    // ============================
    const isProfessionalConsumer =
      dto?.asProfessionalDebt === true || (order as any).consumerType === 'PROFESSIONAL';

    if (isProfessionalConsumer) {
      if (dto?.billingType) {
        throw new BadRequestException(
          'Comanda de débito do profissional não pode ser paga via Asaas',
        );
      }
      const consumerProfessionalId =
        dto?.consumerProfessionalId ||
        (order as any).consumerProfessionalId ||
        (order as any).professionalId;

      if (!consumerProfessionalId) {
        throw new BadRequestException(
          'Profissional consumidor não informado. Defina consumerProfessionalId.',
        );
      }

      return this.payAsProfessionalDebt(id, order, consumerProfessionalId);
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
    const payNow = nowLocalIsoString();
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
          appointmentId: (order as any).appointmentId ?? null,
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
        .maybeSingle();

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
    const dueDate = dto.dueDate || nowLocalIsoString().split('T')[0];

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

    const asaasNow = nowLocalIsoString();
    const { data: payment } = await this.supabase
      .from('payments')
      .insert({
        id: randomUUID(),
        clientId: order.clientId,
        appointmentId: (order as any).appointmentId ?? null,
        amount: order.totalAmount,
        method: paymentMethodMap[dto.billingType!] || 'PIX',
        // paidAt fica NULL até o webhook Asaas confirmar — caso contrário
        // cobranças geradas e nunca pagas entram no caixa do dia da geração.
        paidAt: null,
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

  /**
   * Lança a comanda como débito do profissional consumidor.
   * - Dá baixa no estoque (consumo é real, mesmo sem entrada no caixa).
   * - Cria registro em professional_debts (será deduzido na próxima comissão).
   * - Marca a comanda como PAID_AS_DEBT.
   * - NÃO cria payment (nada entra no caixa).
   * - NÃO marca o agendamento vinculado como pago (débito ≠ pagamento ao salão).
   */
  private async payAsProfessionalDebt(
    id: string,
    order: any,
    consumerProfessionalId: string,
  ) {
    // Baixa no estoque
    const productItems = (order.items || []).filter(
      (i: any) => i.itemType === 'PRODUCT' && i.productId,
    );
    for (const item of productItems) {
      try {
        await this.stockService.create({
          productId: item.productId,
          type: 'EXIT',
          quantity: item.quantity,
          reason: `Comanda #${order.id.slice(0, 8)} (débito do profissional)`,
        });
      } catch (err) {
        this.logger.error(
          `Erro ao dar baixa no estoque do produto ${item.productId}: ${err.message}`,
        );
        throw new BadRequestException(`Erro ao dar baixa no estoque: ${err.message}`);
      }
    }

    // Cria o débito do profissional
    await this.professionalDebtsService.createFromOrder({
      professionalId: consumerProfessionalId,
      orderId: order.id,
      amount: order.totalAmount,
      description: `Comanda #${order.id.slice(0, 8)}`,
    });

    // Atualiza a comanda
    const now = nowLocalIsoString();
    await this.supabase
      .from('orders')
      .update({
        status: 'PAID_AS_DEBT',
        consumerType: 'PROFESSIONAL',
        consumerProfessionalId,
        updatedAt: now,
      })
      .eq('id', id);

    return this.findOne(id);
  }

  async cancel(id: string) {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, clientId, items:order_items(id, itemType, productId, quantity, consumedSubscriptionCut)')
      .eq('id', id)
      .single();

    if (error || !order) {
      throw new NotFoundException('Comanda não encontrada');
    }

    if (order.status !== 'PENDING' && order.status !== 'PAID_AS_DEBT') {
      throw new BadRequestException(
        'Apenas comandas pendentes ou lançadas como débito podem ser canceladas',
      );
    }

    // Devolver créditos de assinatura consumidos pelos itens desta comanda.
    // Soma as quantidades dos itens marcados com consumedSubscriptionCut=true.
    const cutsToRefund = ((order as any).items || []).reduce(
      (sum: number, i: any) => sum + (i.consumedSubscriptionCut ? (i.quantity || 1) : 0),
      0,
    );
    if (cutsToRefund > 0 && (order as any).clientId) {
      const sub = await getActiveClientSubscription(this.supabase, (order as any).clientId);
      if (sub) {
        await this.refundSubscriptionCuts(sub.subscriptionId, cutsToRefund);
      }
    }

    // Reverter efeitos colaterais quando a comanda já tinha sido lançada como débito
    if (order.status === 'PAID_AS_DEBT') {
      // 1) Reentrada no estoque
      const productItems = ((order as any).items || []).filter(
        (i: any) => i.itemType === 'PRODUCT' && i.productId,
      );
      for (const item of productItems) {
        try {
          await this.stockService.create({
            productId: item.productId,
            type: 'ENTRY',
            quantity: item.quantity,
            reason: `Estorno de comanda-débito #${id.slice(0, 8)}`,
          });
        } catch (err) {
          this.logger.error(
            `Erro ao estornar estoque do produto ${item.productId}: ${err.message}`,
          );
          throw new BadRequestException(`Erro ao estornar estoque: ${err.message}`);
        }
      }

      // 2) Anular débito(s) pendentes desta comanda
      try {
        await this.professionalDebtsService.voidByOrder(id);
      } catch (err) {
        this.logger.error(`Erro ao anular débitos da comanda ${id}: ${err.message}`);
        throw new BadRequestException(
          `Erro ao reverter débito do profissional: ${err.message}`,
        );
      }
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('orders')
      .update({ status: 'CANCELED', updatedAt: nowLocalIsoString() })
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
