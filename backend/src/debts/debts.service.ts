import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtDto, UpdateDebtDto, PayDebtDto } from './dto';
import { Debt } from '@prisma/client';

/**
 * DebtsService
 *
 * Gerencia dívidas (fiado) dos clientes.
 *
 * IMPORTANTE - Conceitos separados:
 * - Debt (Dívida): Registro de valor que o cliente deve
 * - Payment (Pagamento): Registro de valor que o cliente pagou
 *
 * Uma dívida pode ser quitada SEM criar um Payment.
 * Exemplo: Cliente paga fiado em dinheiro → registra-se o pagamento
 * parcial da dívida, mas o Payment é opcional (pode ser registrado
 * separadamente pelo PaymentsService se necessário).
 *
 * Regras:
 * - Dívida é independente da forma de pagamento
 * - Dívida pode existir sem agendamento (ex: venda de produto)
 * - Pagamento de dívida NÃO cria Payment automaticamente
 * - NÃO mexe no Caixa (responsabilidade do CashRegisterService)
 */
@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma nova dívida
   *
   * Regras:
   * - amountPaid inicia em 0
   * - remainingBalance = amount
   * - Atualiza hasDebts do cliente para true
   */
  async createDebt(dto: CreateDebtDto): Promise<Debt> {
    // 1. Verificar se cliente existe
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 2. Se tem appointmentId, verificar se existe
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
      });

      if (!appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      if (appointment.clientId !== dto.clientId) {
        throw new BadRequestException(
          'O agendamento não pertence a este cliente',
        );
      }
    }

    // 3. Criar dívida e atualizar flag do cliente em transação
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({
        data: {
          clientId: dto.clientId,
          appointmentId: dto.appointmentId,
          amount: dto.amount,
          amountPaid: 0,
          remainingBalance: dto.amount, // Inicia devendo tudo
          description: dto.description,
          dueDate: dto.dueDate,
          isSettled: false,
        },
        include: {
          client: true,
          appointment: true,
        },
      });

      // Atualizar flag hasDebts do cliente
      await tx.client.update({
        where: { id: dto.clientId },
        data: { hasDebts: true },
      });

      return debt;
    });
  }

  /**
   * Registra pagamento parcial ou total de uma dívida
   *
   * Regras:
   * - Incrementa amountPaid
   * - Decrementa remainingBalance
   * - Se remainingBalance chegar a 0 → isSettled = true, paidAt = now
   * - NÃO cria Payment (isso é separado)
   * - Atualiza hasDebts do cliente se não tiver mais dívidas
   */
  async registerPartialPayment(debtId: string, dto: PayDebtDto): Promise<Debt> {
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.isSettled) {
      throw new BadRequestException('Esta dívida já está quitada');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }

    if (dto.amount > debt.remainingBalance) {
      throw new BadRequestException(
        `Valor excede o saldo devedor. Máximo: ${debt.remainingBalance} centavos`,
      );
    }

    const newAmountPaid = debt.amountPaid + dto.amount;
    const newRemainingBalance = debt.remainingBalance - dto.amount;
    const isNowSettled = newRemainingBalance === 0;

    return this.prisma.$transaction(async (tx) => {
      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          amountPaid: newAmountPaid,
          remainingBalance: newRemainingBalance,
          isSettled: isNowSettled,
          paidAt: isNowSettled ? new Date() : null,
        },
        include: {
          client: true,
          appointment: true,
        },
      });

      // Se quitou, verificar se cliente ainda tem outras dívidas
      if (isNowSettled) {
        await this.updateClientHasDebtsFlag(tx, debt.clientId);
      }

      return updatedDebt;
    });
  }

  /**
   * Quita a dívida manualmente (perdão ou ajuste)
   *
   * Útil para:
   * - Perdoar dívida
   * - Ajustes administrativos
   * - Correções
   */
  async settleDebt(id: string): Promise<Debt> {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.isSettled) {
      throw new BadRequestException('Esta dívida já está quitada');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedDebt = await tx.debt.update({
        where: { id },
        data: {
          isSettled: true,
          paidAt: new Date(),
          // Mantém amountPaid e remainingBalance como estão
          // para histórico (quanto foi pago vs quanto foi perdoado)
        },
        include: {
          client: true,
          appointment: true,
        },
      });

      // Verificar se cliente ainda tem outras dívidas
      await this.updateClientHasDebtsFlag(tx, debt.clientId);

      return updatedDebt;
    });
  }

  async findOne(id: string): Promise<Debt> {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: {
        client: true,
        appointment: {
          include: {
            professional: true,
            services: { include: { service: true } },
          },
        },
      },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    return debt;
  }

  async findAll(): Promise<Debt[]> {
    return this.prisma.debt.findMany({
      include: {
        client: true,
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOutstanding(): Promise<Debt[]> {
    return this.prisma.debt.findMany({
      where: { isSettled: false },
      include: {
        client: true,
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByClient(clientId: string): Promise<Debt[]> {
    return this.prisma.debt.findMany({
      where: { clientId },
      include: {
        appointment: {
          include: {
            professional: true,
            services: { include: { service: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOutstandingByClient(clientId: string): Promise<Debt[]> {
    return this.prisma.debt.findMany({
      where: {
        clientId,
        isSettled: false,
      },
      include: {
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Calcula total de dívidas em aberto de um cliente
   * Retorna valor em centavos
   */
  async calculateClientTotalDebt(clientId: string): Promise<number> {
    const result = await this.prisma.debt.aggregate({
      where: {
        clientId,
        isSettled: false,
      },
      _sum: {
        remainingBalance: true,
      },
    });

    return result._sum.remainingBalance ?? 0;
  }

  async update(id: string, dto: UpdateDebtDto): Promise<Debt> {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.isSettled) {
      throw new BadRequestException('Não é possível editar uma dívida quitada');
    }

    return this.prisma.debt.update({
      where: { id },
      data: {
        description: dto.description,
        dueDate: dto.dueDate,
      },
      include: {
        client: true,
        appointment: true,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.debt.delete({
        where: { id },
      });

      // Atualizar flag do cliente
      await this.updateClientHasDebtsFlag(tx, debt.clientId);
    });
  }

  /**
   * Atualiza o flag hasDebts do cliente baseado se tem dívidas em aberto
   * Método privado usado internamente após operações que afetam dívidas
   */
  private async updateClientHasDebtsFlag(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    clientId: string,
  ): Promise<void> {
    const outstandingCount = await tx.debt.count({
      where: {
        clientId,
        isSettled: false,
      },
    });

    await tx.client.update({
      where: { id: clientId },
      data: { hasDebts: outstandingCount > 0 },
    });
  }
}
