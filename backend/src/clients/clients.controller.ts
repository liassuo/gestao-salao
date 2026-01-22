import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateClientDto {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

interface UpdateClientDto {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive?: boolean;
}

interface ClientFilters {
  search?: string;
  hasDebts?: string;
  isActive?: string;
}

@Controller('clients')
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /clients
   * Retorna todos os clientes com filtros opcionais
   */
  @Get()
  async findAll(@Query() filters: ClientFilters) {
    const where: any = {};

    // Filtro por status ativo
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    // Filtro por dívidas
    if (filters.hasDebts !== undefined) {
      where.hasDebts = filters.hasDebts === 'true';
    }

    // Busca por nome, email ou telefone
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    return this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        hasDebts: true,
        isActive: true,
        notes: true,
        createdAt: true,
        _count: {
          select: {
            appointments: true,
            debts: { where: { isSettled: false } },
          },
        },
      },
    });
  }

  /**
   * GET /clients/:id
   * Retorna um cliente específico com detalhes
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        hasDebts: true,
        isActive: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        appointments: {
          take: 5,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            totalPrice: true,
          },
        },
        debts: {
          where: { isSettled: false },
          select: {
            id: true,
            amount: true,
            remainingBalance: true,
            createdAt: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return client;
  }

  /**
   * POST /clients
   * Cria um novo cliente
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        notes: dto.notes,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * PATCH /clients/:id
   * Atualiza um cliente
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const client = await this.prisma.client.findUnique({ where: { id } });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return this.prisma.client.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        notes: true,
        updatedAt: true,
      },
    });
  }

  /**
   * DELETE /clients/:id
   * Desativa um cliente (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    await this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
