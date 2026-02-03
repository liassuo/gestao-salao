import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockMovementDto, QueryStockMovementDto } from './dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStockMovementDto) {
    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    // For EXIT, validate enough stock
    if (dto.type === 'EXIT') {
      const movements = await this.prisma.stockMovement.findMany({
        where: { productId: dto.productId },
        select: { type: true, quantity: true },
      });
      const currentStock = movements.reduce((acc, m) => {
        return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
      }, 0);
      if (currentStock < dto.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente. Estoque atual: ${currentStock}`,
        );
      }
    }

    return this.prisma.stockMovement.create({
      data: {
        productId: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason,
        branchId: dto.branchId,
      },
      select: {
        id: true, type: true, quantity: true, reason: true, createdAt: true,
        product: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(query: QueryStockMovementDto) {
    const where: any = {};
    if (query.productId) where.productId = query.productId;
    if (query.type) where.type = query.type;
    if (query.branchId) where.branchId = query.branchId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate + 'T23:59:59.999Z');
    }

    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, quantity: true, reason: true, createdAt: true, createdBy: true,
        product: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      select: {
        id: true, type: true, quantity: true, reason: true, createdAt: true, createdBy: true,
        product: { select: { id: true, name: true, salePrice: true, costPrice: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!movement) throw new NotFoundException('Movimentação não encontrada');
    return movement;
  }
}
