import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import { Payment, PaymentMethod } from '@prisma/client';

/**
 * PaymentsService
 *
 * IMPORTANTE - Este service apenas REGISTRA pagamentos:
 * - NÃO processa transações financeiras
 * - NÃO integra com gateways (Stripe, PagSeguro, etc.)
 * - NÃO movimenta dinheiro real
 *
 * O fluxo é:
 * 1. Cliente paga presencialmente (dinheiro, PIX, cartão)
 * 2. Funcionário registra o pagamento manualmente aqui
 * 3. Sistema apenas rastreia para controle e relatórios
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um pagamento
   *
   * Regras:
   * - Se appointmentId fornecido, vincula ao agendamento
   * - Verifica se agendamento já não está pago
   * - Atualiza Appointment.isPaid = true
   * - NÃO cria Debt (isso é responsabilidade do DebtsService)
   * - NÃO mexe no Caixa (isso é responsabilidade do CashRegisterService)
   */
  async registerPayment(dto: CreatePaymentDto): Promise<Payment> {
    // 1. Verificar se o cliente existe
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 2. Verificar se o usuário que registra existe
    const registeredByUser = await this.prisma.user.findUnique({
      where: { id: dto.registeredBy },
    });

    if (!registeredByUser) {
      throw new NotFoundException('Usuário que registra não encontrado');
    }

    // 3. Se tem appointmentId, validar agendamento
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
      });

      if (!appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      // Não permite registrar pagamento se já está pago
      if (appointment.isPaid) {
        throw new BadRequestException('Este agendamento já está pago');
      }

      // Verifica se o agendamento pertence ao cliente
      if (appointment.clientId !== dto.clientId) {
        throw new BadRequestException(
          'O agendamento não pertence a este cliente',
        );
      }
    }

    // 4. Criar o pagamento e atualizar agendamento em transação
    return this.prisma.$transaction(async (tx) => {
      // Criar registro do pagamento
      const payment = await tx.payment.create({
        data: {
          clientId: dto.clientId,
          appointmentId: dto.appointmentId,
          amount: dto.amount,
          method: dto.method,
          paidAt: dto.paidAt ?? new Date(),
          registeredBy: dto.registeredBy,
          notes: dto.notes,
        },
        include: {
          client: true,
          appointment: true,
          registeredByUser: true,
        },
      });

      // Se vinculado a agendamento, marcar como pago
      if (dto.appointmentId) {
        await tx.appointment.update({
          where: { id: dto.appointmentId },
          data: { isPaid: true },
        });
      }

      return payment;
    });
  }

  /**
   * Remove um pagamento registrado incorretamente
   *
   * Regras:
   * - Apenas para correções administrativas
   * - Se estava vinculado a agendamento, volta isPaid = false
   * - NÃO deve ser usado para estornos reais
   */
  async unlinkPayment(id: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      // Se estava vinculado a agendamento, desmarcar como pago
      if (payment.appointmentId) {
        await tx.appointment.update({
          where: { id: payment.appointmentId },
          data: { isPaid: false },
        });
      }

      // Remover o pagamento
      await tx.payment.delete({
        where: { id },
      });
    });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        client: true,
        appointment: {
          include: {
            professional: true,
            services: { include: { service: true } },
          },
        },
        registeredByUser: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    return payment;
  }

  async findAll(): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      include: {
        client: true,
        appointment: true,
        registeredByUser: true,
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async findByClient(clientId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { clientId },
      include: {
        appointment: {
          include: {
            professional: true,
            services: { include: { service: true } },
          },
        },
        registeredByUser: true,
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: {
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: true,
        appointment: true,
        registeredByUser: true,
      },
      orderBy: { paidAt: 'asc' },
    });
  }

  async findByMethod(method: PaymentMethod): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { method },
      include: {
        client: true,
        appointment: true,
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  /**
   * Calcula totais por método de pagamento em um período
   * Usado para fechamento de caixa
   */
  async calculateTotalsByMethod(
    startDate: Date,
    endDate: Date,
  ): Promise<{ CASH: number; PIX: number; CARD: number; total: number }> {
    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        method: true,
      },
    });

    const totals = {
      CASH: 0,
      PIX: 0,
      CARD: 0,
      total: 0,
    };

    for (const payment of payments) {
      totals[payment.method] += payment.amount;
      totals.total += payment.amount;
    }

    return totals;
  }

  /**
   * Atualiza informações do pagamento
   * Apenas para correções (ex: método errado, valor errado)
   */
  async update(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        amount: dto.amount,
        method: dto.method,
        notes: dto.notes,
      },
      include: {
        client: true,
        appointment: true,
        registeredByUser: true,
      },
    });
  }
}
