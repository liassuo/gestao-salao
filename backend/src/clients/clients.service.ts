import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto';
import { Prisma } from '@prisma/client';

export interface ClientFilters {
  search?: string;
  hasDebts?: boolean;
  isActive?: boolean;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new client
   */
  async create(dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        password: dto.password,
        googleId: dto.googleId,
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
   * Find all clients with optional filters
   */
  async findAll(filters?: ClientFilters) {
    const where: Prisma.ClientWhereInput = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.hasDebts !== undefined) {
      where.hasDebts = filters.hasDebts;
    }

    if (filters?.search) {
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
   * Find client by ID with details
   */
  async findOne(id: string) {
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
   * Find client by email (for authentication)
   */
  async findByEmail(email: string) {
    return this.prisma.client.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        password: true,
        googleId: true,
        isActive: true,
      },
    });
  }

  /**
   * Find clients with active debts
   */
  async findClientsWithDebts() {
    return this.prisma.client.findMany({
      where: {
        hasDebts: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        debts: {
          where: { isSettled: false },
          select: {
            id: true,
            amount: true,
            remainingBalance: true,
            dueDate: true,
          },
        },
      },
    });
  }

  /**
   * Update client information
   */
  async update(id: string, dto: UpdateClientDto) {
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
   * Soft delete client
   */
  async remove(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    await this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Update hasDebts flag for a client
   * Should be called when debts are created, paid, or settled
   */
  async updateDebtStatus(clientId: string) {
    const activeDebts = await this.prisma.debt.count({
      where: {
        clientId,
        isSettled: false,
      },
    });

    await this.prisma.client.update({
      where: { id: clientId },
      data: { hasDebts: activeDebts > 0 },
    });
  }
}
