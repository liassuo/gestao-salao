import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFinancialTransactionDto,
  UpdateFinancialTransactionDto,
  QueryFinancialTransactionDto,
} from './dto';
import { Prisma } from '@prisma/client';

/**
 * FinancialTransactionsService
 *
 * Gerencia transacoes financeiras (despesas e receitas).
 *
 * Conceitos:
 * - EXPENSE: Contas a pagar (despesas)
 * - REVENUE: Contas a receber (receitas)
 * - amount: Valor bruto em centavos
 * - netAmount: Valor liquido calculado com desconto e juros
 * - netAmount = amount - (amount * discount/100) + (amount * interest/100)
 *
 * Regras:
 * - Todas as transacoes tem categoria obrigatoria
 * - Subcategoria, filial, conta bancaria e metodo de pagamento sao opcionais
 * - Ao marcar como pago, define paidAt e status = PAID
 * - Totais de contas a pagar/receber consideram data de vencimento e status
 */
@Injectable()
export class FinancialTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula o valor liquido baseado em amount, discount e interest
   * netAmount = amount - (amount * discount/100) + (amount * interest/100)
   */
  private calculateNetAmount(
    amount: number,
    discount?: number,
    interest?: number,
  ): number {
    const discountValue = discount
      ? Math.round(amount * discount / 100)
      : 0;
    const interestValue = interest
      ? Math.round(amount * interest / 100)
      : 0;

    return amount - discountValue + interestValue;
  }

  /**
   * Includes padrao para retornar relacoes completas
   */
  private readonly defaultInclude = {
    category: true,
    subcategory: true,
    branch: true,
    bankAccount: true,
    paymentMethodConfig: true,
  };

  /**
   * Cria uma nova transacao financeira (despesa ou receita)
   */
  async create(dto: CreateFinancialTransactionDto) {
    // Validar categoria
    const category = await this.prisma.financialCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoria nao encontrada');
    }

    // Validar subcategoria se informada
    if (dto.subcategoryId) {
      const subcategory = await this.prisma.financialCategory.findUnique({
        where: { id: dto.subcategoryId },
      });

      if (!subcategory) {
        throw new NotFoundException('Subcategoria nao encontrada');
      }
    }

    // Validar filial se informada
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
      });

      if (!branch) {
        throw new NotFoundException('Filial nao encontrada');
      }
    }

    // Validar conta bancaria se informada
    if (dto.bankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({
        where: { id: dto.bankAccountId },
      });

      if (!bankAccount) {
        throw new NotFoundException('Conta bancaria nao encontrada');
      }
    }

    // Validar metodo de pagamento se informado
    if (dto.paymentMethodConfigId) {
      const paymentMethodConfig = await this.prisma.paymentMethodConfig.findUnique({
        where: { id: dto.paymentMethodConfigId },
      });

      if (!paymentMethodConfig) {
        throw new NotFoundException('Configuracao de metodo de pagamento nao encontrada');
      }
    }

    const netAmount = this.calculateNetAmount(
      dto.amount,
      dto.discount,
      dto.interest,
    );

    return this.prisma.financialTransaction.create({
      data: {
        type: dto.type,
        description: dto.description,
        amount: dto.amount,
        discount: dto.discount != null ? new Prisma.Decimal(dto.discount) : null,
        interest: dto.interest != null ? new Prisma.Decimal(dto.interest) : null,
        netAmount,
        paymentCondition: dto.paymentCondition,
        isRecurring: dto.isRecurring ?? false,
        dueDate: new Date(dto.dueDate),
        branchId: dto.branchId,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        bankAccountId: dto.bankAccountId,
        paymentMethodConfigId: dto.paymentMethodConfigId,
        notes: dto.notes,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Lista transacoes com filtros opcionais
   */
  async findAll(query: QueryFinancialTransactionDto) {
    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.description) {
      where.description = {
        contains: query.description,
        mode: 'insensitive',
      };
    }

    if (query.startDate || query.endDate) {
      where.dueDate = {};
      if (query.startDate) {
        where.dueDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dueDate.lte = new Date(query.endDate);
      }
    }

    return this.prisma.financialTransaction.findMany({
      where,
      include: this.defaultInclude,
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Contas a pagar (EXPENSE) com totais
   *
   * Retorna:
   * - overdue: Vencido (dueDate < hoje E status PENDING)
   * - toPay: A pagar (dueDate >= hoje E status PENDING)
   * - paid: Pago (status PAID)
   * - totalToPay: Total a pagar (overdue + toPay)
   * - taxes: Taxas (soma dos valores de juros)
   * - totalWithTaxes: Total com taxas
   * - transactions: Lista de transacoes
   */
  async getPayableTotals(query: QueryFinancialTransactionDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseWhere: any = {
      type: 'EXPENSE',
    };

    if (query.branchId) {
      baseWhere.branchId = query.branchId;
    }

    if (query.categoryId) {
      baseWhere.categoryId = query.categoryId;
    }

    if (query.startDate || query.endDate) {
      baseWhere.dueDate = {};
      if (query.startDate) {
        baseWhere.dueDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        baseWhere.dueDate.lte = new Date(query.endDate);
      }
    }

    // Buscar todas as transacoes EXPENSE com os filtros
    const transactions = await this.prisma.financialTransaction.findMany({
      where: baseWhere,
      include: this.defaultInclude,
      orderBy: { dueDate: 'asc' },
    });

    // Calcular totais
    let overdue = 0;
    let toPay = 0;
    let paid = 0;
    let taxes = 0;

    for (const tx of transactions) {
      const interestPercent = tx.interest ? Number(tx.interest) : 0;
      const interestAmount = Math.round(tx.amount * interestPercent / 100);
      taxes += interestAmount;

      if (tx.status === 'PAID') {
        paid += tx.netAmount;
      } else if (tx.status === 'PENDING' && tx.dueDate < today) {
        overdue += tx.netAmount;
      } else if (tx.status === 'PENDING' && tx.dueDate >= today) {
        toPay += tx.netAmount;
      }
    }

    const totalToPay = overdue + toPay;
    const totalWithTaxes = totalToPay + taxes;

    return {
      overdue,
      toPay,
      paid,
      totalToPay,
      taxes,
      totalWithTaxes,
      transactions,
    };
  }

  /**
   * Contas a receber (REVENUE) com totais
   *
   * Retorna:
   * - notReceived: Nao recebidos (status PENDING E dueDate < hoje)
   * - toReceive: A receber (status PENDING E dueDate >= hoje)
   * - received: Recebido (status PAID)
   * - totalToReceive: Total a receber (notReceived + toReceive)
   * - transactions: Lista de transacoes
   */
  async getReceivableTotals(query: QueryFinancialTransactionDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseWhere: any = {
      type: 'REVENUE',
    };

    if (query.branchId) {
      baseWhere.branchId = query.branchId;
    }

    if (query.categoryId) {
      baseWhere.categoryId = query.categoryId;
    }

    if (query.startDate || query.endDate) {
      baseWhere.dueDate = {};
      if (query.startDate) {
        baseWhere.dueDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        baseWhere.dueDate.lte = new Date(query.endDate);
      }
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where: baseWhere,
      include: this.defaultInclude,
      orderBy: { dueDate: 'asc' },
    });

    let notReceived = 0;
    let toReceive = 0;
    let received = 0;

    for (const tx of transactions) {
      if (tx.status === 'PAID') {
        received += tx.netAmount;
      } else if (tx.status === 'PENDING' && tx.dueDate < today) {
        notReceived += tx.netAmount;
      } else if (tx.status === 'PENDING' && tx.dueDate >= today) {
        toReceive += tx.netAmount;
      }
    }

    const totalToReceive = notReceived + toReceive;

    return {
      notReceived,
      toReceive,
      received,
      totalToReceive,
      transactions,
    };
  }

  /**
   * Balanco/movimentacoes por periodo com filtro opcional de filial
   *
   * Retorna lista de transacoes no periodo e resumo de entradas/saidas
   */
  async getBalance(query: QueryFinancialTransactionDto) {
    const where: any = {};

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.startDate || query.endDate) {
      where.dueDate = {};
      if (query.startDate) {
        where.dueDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dueDate.lte = new Date(query.endDate);
      }
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where,
      include: this.defaultInclude,
      orderBy: { dueDate: 'asc' },
    });

    let totalRevenue = 0;
    let totalExpense = 0;

    for (const tx of transactions) {
      if (tx.type === 'REVENUE' && tx.status === 'PAID') {
        totalRevenue += tx.netAmount;
      } else if (tx.type === 'EXPENSE' && tx.status === 'PAID') {
        totalExpense += tx.netAmount;
      }
    }

    const balance = totalRevenue - totalExpense;

    return {
      totalRevenue,
      totalExpense,
      balance,
      transactions,
    };
  }

  /**
   * Busca uma transacao por ID com todas as relacoes
   */
  async findOne(id: string) {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id },
      include: this.defaultInclude,
    });

    if (!transaction) {
      throw new NotFoundException('Transacao financeira nao encontrada');
    }

    return transaction;
  }

  /**
   * Marca uma transacao como paga
   * Define paidAt = agora e status = PAID
   */
  async markAsPaid(id: string) {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transacao financeira nao encontrada');
    }

    if (transaction.status === 'PAID') {
      throw new BadRequestException('Esta transacao ja esta paga');
    }

    if (transaction.status === 'CANCELED') {
      throw new BadRequestException('Nao e possivel pagar uma transacao cancelada');
    }

    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Atualiza uma transacao financeira
   * Recalcula netAmount se amount, discount ou interest foram alterados
   */
  async update(id: string, dto: UpdateFinancialTransactionDto) {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transacao financeira nao encontrada');
    }

    // Validar categoria se informada
    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Categoria nao encontrada');
      }
    }

    // Validar subcategoria se informada
    if (dto.subcategoryId) {
      const subcategory = await this.prisma.financialCategory.findUnique({
        where: { id: dto.subcategoryId },
      });

      if (!subcategory) {
        throw new NotFoundException('Subcategoria nao encontrada');
      }
    }

    // Validar filial se informada
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
      });

      if (!branch) {
        throw new NotFoundException('Filial nao encontrada');
      }
    }

    // Validar conta bancaria se informada
    if (dto.bankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({
        where: { id: dto.bankAccountId },
      });

      if (!bankAccount) {
        throw new NotFoundException('Conta bancaria nao encontrada');
      }
    }

    // Validar metodo de pagamento se informado
    if (dto.paymentMethodConfigId) {
      const paymentMethodConfig = await this.prisma.paymentMethodConfig.findUnique({
        where: { id: dto.paymentMethodConfigId },
      });

      if (!paymentMethodConfig) {
        throw new NotFoundException('Configuracao de metodo de pagamento nao encontrada');
      }
    }

    // Preparar dados para atualizacao
    const data: any = {};

    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.paymentCondition !== undefined) data.paymentCondition = dto.paymentCondition;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.branchId !== undefined) data.branchId = dto.branchId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.subcategoryId !== undefined) data.subcategoryId = dto.subcategoryId;
    if (dto.bankAccountId !== undefined) data.bankAccountId = dto.bankAccountId;
    if (dto.paymentMethodConfigId !== undefined) data.paymentMethodConfigId = dto.paymentMethodConfigId;
    if (dto.notes !== undefined) data.notes = dto.notes;

    // Recalcular netAmount se amount, discount ou interest mudaram
    const needsRecalculation =
      dto.amount !== undefined ||
      dto.discount !== undefined ||
      dto.interest !== undefined;

    if (needsRecalculation) {
      const newAmount = dto.amount ?? transaction.amount;
      const newDiscount = dto.discount !== undefined
        ? dto.discount
        : transaction.discount
          ? Number(transaction.discount)
          : undefined;
      const newInterest = dto.interest !== undefined
        ? dto.interest
        : transaction.interest
          ? Number(transaction.interest)
          : undefined;

      data.amount = newAmount;
      data.discount = newDiscount != null ? new Prisma.Decimal(newDiscount) : null;
      data.interest = newInterest != null ? new Prisma.Decimal(newInterest) : null;
      data.netAmount = this.calculateNetAmount(newAmount, newDiscount, newInterest);
    } else {
      if (dto.amount !== undefined) data.amount = dto.amount;
    }

    return this.prisma.financialTransaction.update({
      where: { id },
      data,
      include: this.defaultInclude,
    });
  }

  /**
   * Remove uma transacao financeira
   */
  async remove(id: string): Promise<void> {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transacao financeira nao encontrada');
    }

    await this.prisma.financialTransaction.delete({
      where: { id },
    });
  }
}
