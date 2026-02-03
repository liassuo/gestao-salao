import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        minStock: dto.minStock ?? 0,
        branchId: dto.branchId,
      },
      select: {
        id: true, name: true, description: true, costPrice: true,
        salePrice: true, minStock: true, isActive: true, branchId: true, createdAt: true,
      },
    });
  }

  async findAll(query: QueryProductDto) {
    const where: any = {};
    if (query.all !== 'true') where.isActive = true;
    if (query.branchId) where.branchId = query.branchId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    return this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, description: true, costPrice: true,
        salePrice: true, minStock: true, isActive: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true, costPrice: true,
        salePrice: true, minStock: true, isActive: true, branchId: true,
        createdAt: true, updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async getStock(branchId?: string) {
    const where: any = { isActive: true };
    if (branchId) where.branchId = branchId;

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true, name: true, costPrice: true, salePrice: true, minStock: true,
        branch: { select: { id: true, name: true } },
        stockMovements: { select: { type: true, quantity: true } },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => {
      const currentStock = p.stockMovements.reduce((acc, m) => {
        return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
      }, 0);
      return {
        id: p.id,
        name: p.name,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        minStock: p.minStock,
        currentStock,
        stockValue: currentStock * p.costPrice,
        potentialSaleValue: currentStock * p.salePrice,
        isLowStock: currentStock <= p.minStock,
        branch: p.branch,
      };
    });
  }

  async getLowStock(branchId?: string) {
    const stock = await this.getStock(branchId);
    return stock.filter((p) => p.isLowStock);
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return this.prisma.product.update({
      where: { id },
      data: dto,
      select: {
        id: true, name: true, description: true, costPrice: true,
        salePrice: true, minStock: true, isActive: true, updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
