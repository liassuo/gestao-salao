import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto, PayOrderDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly orderSelect = {
    id: true, status: true, totalAmount: true, notes: true, createdAt: true, updatedAt: true,
    client: { select: { id: true, name: true } },
    professional: { select: { id: true, name: true } },
    branch: { select: { id: true, name: true } },
    items: {
      select: {
        id: true, quantity: true, unitPrice: true, itemType: true,
        product: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    },
  };

  async create(dto: CreateOrderDto) {
    let totalAmount = 0;
    const itemsData = (dto.items || []).map((item) => {
      const lineTotal = item.unitPrice * (item.quantity || 1);
      totalAmount += lineTotal;
      return {
        productId: item.productId,
        serviceId: item.serviceId,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
      };
    });

    return this.prisma.order.create({
      data: {
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        notes: dto.notes,
        totalAmount,
        items: itemsData.length > 0 ? { create: itemsData } : undefined,
      },
      select: this.orderSelect,
    });
  }

  async findAll(query: QueryOrderDto) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.branchId) where.branchId = query.branchId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate + 'T23:59:59.999Z');
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: this.orderSelect,
    });
  }

  async findPending() {
    return this.prisma.order.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: this.orderSelect,
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: this.orderSelect,
    });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    return order;
  }

  async addItem(orderId: string, dto: AddOrderItemDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Só é possível adicionar itens a comandas pendentes');
    }

    const lineTotal = dto.unitPrice * (dto.quantity || 1);

    await this.prisma.$transaction([
      this.prisma.orderItem.create({
        data: {
          orderId,
          productId: dto.productId,
          serviceId: dto.serviceId,
          quantity: dto.quantity || 1,
          unitPrice: dto.unitPrice,
          itemType: dto.itemType,
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { totalAmount: { increment: lineTotal } },
      }),
    ]);

    return this.findOne(orderId);
  }

  async removeItem(orderId: string, itemId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Só é possível remover itens de comandas pendentes');
    }

    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item || item.orderId !== orderId) {
      throw new NotFoundException('Item não encontrado nesta comanda');
    }

    const lineTotal = item.unitPrice * item.quantity;

    await this.prisma.$transaction([
      this.prisma.orderItem.delete({ where: { id: itemId } }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { totalAmount: { decrement: lineTotal } },
      }),
    ]);
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    return this.prisma.order.update({
      where: { id },
      data: dto,
      select: this.orderSelect,
    });
  }

  async pay(id: string, dto?: PayOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Comanda não está pendente');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Baixa automatica no estoque para cada produto
      const productItems = order.items.filter((i) => i.itemType === 'PRODUCT' && i.productId);
      for (const item of productItems) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId!,
            type: 'EXIT',
            quantity: item.quantity,
            reason: `Venda via comanda #${order.id.slice(0, 8)}`,
          },
        });
      }

      // 2. Criar registro de pagamento se metodo informado e comanda tem cliente
      let paymentId: string | undefined;
      if (dto?.paymentMethod && order.clientId) {
        const payment = await tx.payment.create({
          data: {
            clientId: order.clientId,
            amount: order.totalAmount,
            method: dto.paymentMethod,
            paidAt: new Date(),
            registeredBy: dto.registeredBy || order.clientId,
            notes: `Pagamento comanda #${order.id.slice(0, 8)}`,
          },
        });
        paymentId = payment.id;

        // Vincular pagamento ao caixa aberto do dia
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const openRegister = await tx.cashRegister.findFirst({
          where: { isOpen: true },
        });
        if (openRegister) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { cashRegisterId: openRegister.id },
          });
        }
      }

      // 3. Atualizar status da comanda
      await tx.order.update({
        where: { id },
        data: {
          status: 'PAID',
          paymentId: paymentId,
        },
      });

      return this.findOne(id);
    });
  }

  async cancel(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Comanda não está pendente');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELED' },
      select: this.orderSelect,
    });
  }

  async remove(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    await this.prisma.order.delete({ where: { id } });
  }
}
