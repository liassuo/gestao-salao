import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';
import { Commission, CommissionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * CommissionsService
 *
 * Gerencia comissões dos profissionais baseadas em atendimentos realizados.
 *
 * Regras:
 * - Comissões são geradas para um período (startDate a endDate)
 * - Apenas agendamentos com status ATTENDED são considerados
 * - Cálculo: soma de (appointment.totalPrice * professional.commissionRate / 100)
 * - Valores em centavos (inteiros)
 * - Cada registro de comissão é por profissional por período
 */
@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera comissões para todos os profissionais em um período
   *
   * Fluxo:
   * 1. Busca todos os agendamentos ATTENDED no período
   * 2. Agrupa por professionalId
   * 3. Para cada profissional, obtém a commissionRate
   * 4. Calcula: soma de (appointment.totalPrice * commissionRate / 100)
   * 5. Cria registros de Commission para cada profissional
   */
  async generate(dto: GenerateCommissionDto): Promise<Commission[]> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException(
        'A data de início deve ser anterior à data de fim',
      );
    }

    // 1. Buscar agendamentos ATTENDED no período
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'ATTENDED',
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        professional: true,
      },
    });

    if (appointments.length === 0) {
      throw new BadRequestException(
        'Nenhum atendimento encontrado no período informado',
      );
    }

    // 2. Agrupar por professionalId
    const groupedByProfessional = new Map<
      string,
      { totalPrice: number; branchId: string | null }
    >();

    for (const appointment of appointments) {
      const existing = groupedByProfessional.get(appointment.professionalId);
      if (existing) {
        existing.totalPrice += appointment.totalPrice;
      } else {
        groupedByProfessional.set(appointment.professionalId, {
          totalPrice: appointment.totalPrice,
          branchId: appointment.professional.branchId,
        });
      }
    }

    // 3. Para cada profissional, buscar commissionRate e calcular comissão
    const createdCommissions: Commission[] = [];

    for (const [professionalId, data] of groupedByProfessional) {
      const professional = await this.prisma.professional.findUnique({
        where: { id: professionalId },
      });

      if (!professional) {
        continue; // Pula se profissional não existe mais
      }

      if (!professional.commissionRate) {
        continue; // Pula profissionais sem taxa de comissão configurada
      }

      // 4. Calcular: totalPrice * commissionRate / 100
      const rate = new Decimal(professional.commissionRate.toString());
      const commissionAmount = Math.round(
        (data.totalPrice * rate.toNumber()) / 100,
      );

      if (commissionAmount <= 0) {
        continue; // Pula se comissão é zero
      }

      // 5. Criar registro de comissão
      const commission = await this.prisma.commission.create({
        data: {
          amount: commissionAmount,
          periodStart: startDate,
          periodEnd: endDate,
          status: 'PENDING',
          professionalId,
          branchId: data.branchId,
        },
        include: {
          professional: true,
          branch: true,
        },
      });

      createdCommissions.push(commission);
    }

    if (createdCommissions.length === 0) {
      throw new BadRequestException(
        'Nenhuma comissão gerada. Verifique se os profissionais possuem taxa de comissão configurada',
      );
    }

    return createdCommissions;
  }

  /**
   * Lista comissões com filtros opcionais
   */
  async findAll(query: QueryCommissionDto): Promise<Commission[]> {
    const where: any = {};

    if (query.professionalId) {
      where.professionalId = query.professionalId;
    }

    if (query.status) {
      where.status = query.status as CommissionStatus;
    }

    if (query.startDate || query.endDate) {
      where.periodStart = {};
      if (query.startDate) {
        where.periodStart.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.periodStart.lte = new Date(query.endDate);
      }
    }

    return this.prisma.commission.findMany({
      where,
      include: {
        professional: true,
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca uma comissão por ID com relacionamentos
   */
  async findOne(id: string): Promise<Commission> {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      include: {
        professional: true,
        branch: true,
      },
    });

    if (!commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    return commission;
  }

  /**
   * Marca uma comissão como paga
   * Define status = PAID e paidAt = agora
   */
  async markAsPaid(id: string): Promise<Commission> {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    if (commission.status === 'PAID') {
      throw new BadRequestException('Esta comissão já foi paga');
    }

    return this.prisma.commission.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        professional: true,
        branch: true,
      },
    });
  }

  /**
   * Remove uma comissão
   */
  async remove(id: string): Promise<void> {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    await this.prisma.commission.delete({
      where: { id },
    });
  }
}
