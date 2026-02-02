import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new branch
   */
  async create(dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Find all branches
   */
  async findAll() {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            professionals: true,
          },
        },
      },
    });
  }

  /**
   * Find active branches only
   */
  async findActive() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
      },
    });
  }

  /**
   * Find branch by ID
   */
  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            professionals: true,
            transactions: true,
            commissions: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    return branch;
  }

  /**
   * Update branch information
   */
  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });

    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    return this.prisma.branch.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft delete branch
   */
  async remove(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });

    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
