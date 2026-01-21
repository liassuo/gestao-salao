import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenCashRegisterDto, CloseCashRegisterDto } from './dto';
import { CashRegister } from '@prisma/client';

/**
 * CashRegisterService
 *
 * Gerencia o caixa diário do estabelecimento.
 *
 * Regras:
 * - Só pode existir 1 caixa por dia (date é unique no banco)
 * - Pagamentos entram no caixa pelo campo paidAt
 * - Caixa não cria Payment nem Debt (apenas consulta)
 *
 * Fluxo típico:
 * 1. Abertura do caixa pela manhã (openRegister)
 * 2. Pagamentos são registrados ao longo do dia (PaymentsService)
 * 3. Fechamento do caixa à noite (closeRegister)
 */
@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Abre o caixa do dia
   *
   * Regras:
   * - Só pode ter 1 caixa por dia
   * - Verifica se já existe caixa aberto
   * - data é normalizada para 00:00:00
   */
  async openRegister(dto: OpenCashRegisterDto): Promise<CashRegister> {
    // 1. Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.openedBy },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // 2. Normalizar data para 00:00:00 (apenas a data, sem hora)
    const normalizedDate = this.normalizeDate(dto.date ?? new Date());

    // 3. Verificar se já existe caixa para este dia
    const existingRegister = await this.prisma.cashRegister.findUnique({
      where: { date: normalizedDate },
    });

    if (existingRegister) {
      throw new ConflictException('Já existe um caixa para este dia');
    }

    // 4. Verificar se existe algum caixa aberto (mesmo de outro dia)
    const openRegister = await this.prisma.cashRegister.findFirst({
      where: { isOpen: true },
    });

    if (openRegister) {
      throw new BadRequestException(
        'Existe um caixa aberto que precisa ser fechado primeiro',
      );
    }

    // 5. Criar o caixa
    return this.prisma.cashRegister.create({
      data: {
        date: normalizedDate,
        openedAt: new Date(),
        openingBalance: dto.openingBalance,
        openedBy: dto.openedBy,
        isOpen: true,
        notes: dto.notes,
      },
      include: {
        openedByUser: true,
      },
    });
  }

  /**
   * Fecha o caixa do dia
   *
   * Fluxo:
   * 1. Busca todos os Payments do dia (pelo paidAt)
   * 2. Soma valores por método (CASH, PIX, CARD)
   * 3. Calcula totalRevenue
   * 4. Calcula discrepancy (diferença entre esperado e informado)
   */
  async closeRegister(
    id: string,
    dto: CloseCashRegisterDto,
  ): Promise<CashRegister> {
    // 1. Buscar o caixa
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
    });

    if (!register) {
      throw new NotFoundException('Caixa não encontrado');
    }

    if (!register.isOpen) {
      throw new BadRequestException('Este caixa já está fechado');
    }

    // 2. Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.closedBy },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // 3. Calcular totais do dia
    const totals = await this.calculateDailyTotals(register.date);

    // 4. Calcular saldo esperado e discrepância
    // Saldo esperado = abertura + dinheiro recebido (só conta CASH no caixa físico)
    const expectedClosingBalance = register.openingBalance + totals.cash;
    const discrepancy = dto.closingBalance - expectedClosingBalance;

    // 5. Fechar o caixa
    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        closedAt: new Date(),
        closedBy: dto.closedBy,
        closingBalance: dto.closingBalance,
        totalCash: totals.cash,
        totalPix: totals.pix,
        totalCard: totals.card,
        totalRevenue: totals.total,
        discrepancy,
        isOpen: false,
        notes: dto.notes ? `${register.notes ?? ''}\n${dto.notes}`.trim() : register.notes,
      },
      include: {
        openedByUser: true,
        closedByUser: true,
        payments: {
          include: {
            client: true,
          },
        },
      },
    });
  }

  /**
   * Retorna o caixa do dia atual, se existir
   */
  async getTodayRegister(): Promise<CashRegister | null> {
    const today = this.normalizeDate(new Date());

    return this.prisma.cashRegister.findUnique({
      where: { date: today },
      include: {
        openedByUser: true,
        closedByUser: true,
        payments: {
          include: {
            client: true,
            appointment: true,
          },
        },
      },
    });
  }

  /**
   * Retorna o caixa aberto atualmente (se houver)
   */
  async findOpen(): Promise<CashRegister | null> {
    return this.prisma.cashRegister.findFirst({
      where: { isOpen: true },
      include: {
        openedByUser: true,
        payments: {
          include: {
            client: true,
          },
        },
      },
    });
  }

  async findOne(id: string): Promise<CashRegister> {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: {
        openedByUser: true,
        closedByUser: true,
        payments: {
          include: {
            client: true,
            appointment: true,
          },
        },
      },
    });

    if (!register) {
      throw new NotFoundException('Caixa não encontrado');
    }

    return register;
  }

  async findByDate(date: Date): Promise<CashRegister | null> {
    const normalizedDate = this.normalizeDate(date);

    return this.prisma.cashRegister.findUnique({
      where: { date: normalizedDate },
      include: {
        openedByUser: true,
        closedByUser: true,
        payments: {
          include: {
            client: true,
            appointment: true,
          },
        },
      },
    });
  }

  async findAll(): Promise<CashRegister[]> {
    return this.prisma.cashRegister.findMany({
      include: {
        openedByUser: true,
        closedByUser: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Calcula totais do dia por método de pagamento
   *
   * Busca todos os Payments onde paidAt está dentro do dia
   * Retorna valores em centavos
   */
  async calculateDailyTotals(
    date: Date,
  ): Promise<{ cash: number; pix: number; card: number; total: number }> {
    const normalizedDate = this.normalizeDate(date);
    const nextDay = new Date(normalizedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: {
          gte: normalizedDate,
          lt: nextDay,
        },
      },
      select: {
        amount: true,
        method: true,
      },
    });

    const totals = {
      cash: 0,
      pix: 0,
      card: 0,
      total: 0,
    };

    for (const payment of payments) {
      switch (payment.method) {
        case 'CASH':
          totals.cash += payment.amount;
          break;
        case 'PIX':
          totals.pix += payment.amount;
          break;
        case 'CARD':
          totals.card += payment.amount;
          break;
      }
      totals.total += payment.amount;
    }

    return totals;
  }

  /**
   * Resumo de um período (para relatórios)
   */
  async getSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRevenue: number;
    totalCash: number;
    totalPix: number;
    totalCard: number;
    totalDiscrepancy: number;
    daysCount: number;
  }> {
    const registers = await this.prisma.cashRegister.findMany({
      where: {
        date: {
          gte: this.normalizeDate(startDate),
          lte: this.normalizeDate(endDate),
        },
        isOpen: false, // Só considera caixas fechados
      },
    });

    const summary = {
      totalRevenue: 0,
      totalCash: 0,
      totalPix: 0,
      totalCard: 0,
      totalDiscrepancy: 0,
      daysCount: registers.length,
    };

    for (const register of registers) {
      summary.totalRevenue += register.totalRevenue ?? 0;
      summary.totalCash += register.totalCash ?? 0;
      summary.totalPix += register.totalPix ?? 0;
      summary.totalCard += register.totalCard ?? 0;
      summary.totalDiscrepancy += register.discrepancy ?? 0;
    }

    return summary;
  }

  /**
   * Vincula um pagamento ao caixa do dia
   * Chamado pelo PaymentsService ao registrar pagamento
   */
  async linkPaymentToRegister(paymentId: string): Promise<void> {
    const todayRegister = await this.getTodayRegister();

    if (todayRegister && todayRegister.isOpen) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { cashRegisterId: todayRegister.id },
      });
    }
  }

  /**
   * Normaliza uma data para 00:00:00 UTC
   * Necessário porque o campo date no banco é do tipo DATE (sem hora)
   */
  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }
}
