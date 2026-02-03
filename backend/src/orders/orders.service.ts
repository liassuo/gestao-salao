import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto } from './dto';

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

  async pay(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Comanda não está pendente');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: 'PAID' },
      select: this.orderSelect,
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
