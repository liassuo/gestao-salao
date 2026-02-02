import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePaymentMethodConfigDto,
  UpdatePaymentMethodConfigDto,
  QueryPaymentMethodConfigDto,
} from './dto';
import { PaymentMethodScope } from '@prisma/client';

@Injectable()
export class PaymentMethodConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma nova configuracao de forma de pagamento
   */
  async create(dto: CreatePaymentMethodConfigDto) {
    return this.prisma.paymentMethodConfig.create({
      data: {
        name: dto.name,
        type: dto.type,
        scope: dto.scope,
      },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Lista todas as formas de pagamento com filtros opcionais
   */
  async findAll(query: QueryPaymentMethodConfigDto) {
    const where: Record<string, unknown> = {};

    if (query.scope) {
      where.scope = query.scope;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    return this.prisma.paymentMethodConfig.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Busca uma forma de pagamento por ID
   */
  async findOne(id: string) {
    const config = await this.prisma.paymentMethodConfig.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }

    return config;
  }

  /**
   * Busca formas de pagamento por escopo (COMANDA, EXPENSE ou BOTH)
   * Retorna apenas as ativas e inclui tambem as com escopo BOTH
   */
  async findByScope(scope: PaymentMethodScope) {
    return this.prisma.paymentMethodConfig.findMany({
      where: {
        isActive: true,
        OR: [{ scope }, { scope: 'BOTH' }],
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        isActive: true,
      },
    });
  }

  /**
   * Atualiza uma forma de pagamento
   */
  async update(id: string, dto: UpdatePaymentMethodConfigDto) {
    const config = await this.prisma.paymentMethodConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }

    return this.prisma.paymentMethodConfig.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Remove (soft delete) uma forma de pagamento
   */
  async remove(id: string) {
    const config = await this.prisma.paymentMethodConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }

    await this.prisma.paymentMethodConfig.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
