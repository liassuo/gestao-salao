import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto';

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new bank account
   */
  async create(dto: CreateBankAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        name: dto.name,
        bank: dto.bank || null,
        accountType: dto.accountType || null,
      },
      select: {
        id: true,
        name: true,
        bank: true,
        accountType: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Find all bank accounts
   */
  async findAll() {
    return this.prisma.bankAccount.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        bank: true,
        accountType: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });
  }

  /**
   * Find only active bank accounts
   */
  async findActive() {
    return this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        bank: true,
        accountType: true,
      },
    });
  }

  /**
   * Find bank account by ID
   */
  async findOne(id: string) {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        bank: true,
        accountType: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!bankAccount) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    return bankAccount;
  }

  /**
   * Update bank account information
   */
  async update(id: string, dto: UpdateBankAccountDto) {
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id } });

    if (!bankAccount) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        bank: true,
        accountType: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft delete bank account
   */
  async remove(id: string) {
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id } });

    if (!bankAccount) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    await this.prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
