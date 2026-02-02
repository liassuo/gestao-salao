import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFinancialCategoryDto,
  UpdateFinancialCategoryDto,
  QueryFinancialCategoryDto,
} from './dto';
import { FinancialCategory } from '@prisma/client';

/**
 * FinancialCategoriesService
 *
 * Gerencia categorias financeiras para classificar transacoes.
 *
 * Suporta hierarquia:
 * - Uma categoria pode ter uma categoria pai (parentId)
 * - Uma categoria pode ter multiplas subcategorias (children)
 *
 * Exemplos:
 * - EXPENSE > Salarios
 * - EXPENSE > Produtos > Shampoo
 * - REVENUE > Servicos > Corte
 */
@Injectable()
export class FinancialCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma nova categoria financeira
   *
   * Se parentId fornecido, valida que a categoria pai existe
   */
  async create(dto: CreateFinancialCategoryDto): Promise<FinancialCategory> {
    // Se tem parentId, verificar se a categoria pai existe
    if (dto.parentId) {
      const parent = await this.prisma.financialCategory.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }
    }

    return this.prisma.financialCategory.create({
      data: {
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  /**
   * Lista todas as categorias financeiras com filtros opcionais
   *
   * Filtros disponiveis:
   * - type: EXPENSE ou REVENUE
   * - parentId: UUID da categoria pai
   * - isActive: 'true' ou 'false' (string do query param)
   */
  async findAll(query: QueryFinancialCategoryDto): Promise<FinancialCategory[]> {
    const where: Record<string, unknown> = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.parentId) {
      where.parentId = query.parentId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    return this.prisma.financialCategory.findMany({
      where,
      include: {
        parent: true,
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Busca uma categoria financeira pelo ID
   * Inclui categoria pai e subcategorias
   */
  async findOne(id: string): Promise<FinancialCategory> {
    const category = await this.prisma.financialCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria financeira não encontrada');
    }

    return category;
  }

  /**
   * Atualiza uma categoria financeira
   */
  async update(
    id: string,
    dto: UpdateFinancialCategoryDto,
  ): Promise<FinancialCategory> {
    const category = await this.prisma.financialCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoria financeira não encontrada');
    }

    // Se esta atualizando o parentId, verificar se a categoria pai existe
    if (dto.parentId) {
      const parent = await this.prisma.financialCategory.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }
    }

    return this.prisma.financialCategory.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive,
        parentId: dto.parentId,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  /**
   * Remove uma categoria financeira
   */
  async remove(id: string): Promise<void> {
    const category = await this.prisma.financialCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoria financeira não encontrada');
    }

    await this.prisma.financialCategory.delete({
      where: { id },
    });
  }
}
