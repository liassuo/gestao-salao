import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';
import { Appointment, AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    // 1. Verificar se o profissional existe e está ativo
    const professional = await this.prisma.professional.findUnique({
      where: { id: dto.professionalId },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    if (!professional.isActive) {
      throw new BadRequestException('Profissional não está ativo');
    }

    // 2. Buscar os serviços e calcular duração total
    const services = await this.prisma.service.findMany({
      where: {
        id: { in: dto.serviceIds },
        isActive: true,
      },
    });

    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('Um ou mais serviços não encontrados ou inativos');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

    // 3. Calcular horário de término do novo agendamento
    const scheduledAt = new Date(dto.scheduledAt);
    const endTime = new Date(scheduledAt.getTime() + totalDuration * 60 * 1000);

    // 4. Verificar conflito de horário com outros agendamentos do profissional
    const conflictingAppointment = await this.prisma.appointment.findFirst({
      where: {
        professionalId: dto.professionalId,
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.ATTENDED] },
        AND: [
          {
            scheduledAt: { lt: endTime },
          },
          {
            // scheduledAt + totalDuration > dto.scheduledAt
            scheduledAt: {
              gte: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000), // Otimização: limita busca
            },
          },
        ],
      },
      include: { services: { include: { service: true } } },
    });

    if (conflictingAppointment) {
      // Calcular fim do agendamento existente
      const existingEnd = new Date(
        conflictingAppointment.scheduledAt.getTime() +
          conflictingAppointment.totalDuration * 60 * 1000,
      );

      // Verificar se realmente há sobreposição
      const hasOverlap =
        scheduledAt < existingEnd && endTime > conflictingAppointment.scheduledAt;

      if (hasOverlap) {
        throw new ConflictException(
          'Profissional já possui agendamento neste horário',
        );
      }
    }

    // 5. Verificar se o cliente existe
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 6. Criar o agendamento com os serviços vinculados
    return this.prisma.appointment.create({
      data: {
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        scheduledAt,
        totalPrice,
        totalDuration,
        status: AppointmentStatus.SCHEDULED,
        notes: dto.notes,
        services: {
          create: dto.serviceIds.map((serviceId) => ({
            serviceId,
          })),
        },
      },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
    });
  }

  async cancel(id: string): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    // Só permite cancelar se ainda não foi atendido
    if (appointment.status === AppointmentStatus.ATTENDED) {
      throw new BadRequestException(
        'Não é possível cancelar um agendamento já atendido',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELED) {
      throw new BadRequestException('Agendamento já está cancelado');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELED,
        canceledAt: new Date(),
      },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
    });
  }

  async markAsAttended(id: string): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status === AppointmentStatus.CANCELED) {
      throw new BadRequestException(
        'Não é possível marcar como atendido um agendamento cancelado',
      );
    }

    if (appointment.status === AppointmentStatus.ATTENDED) {
      throw new BadRequestException('Agendamento já foi marcado como atendido');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.ATTENDED,
        attendedAt: new Date(),
      },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
    });
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
        payment: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return appointment;
  }

  async findAll(): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findByProfessionalAndDate(
    professionalId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        professionalId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: true,
        services: { include: { service: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findByClient(clientId: string): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: { clientId },
      include: {
        professional: true,
        services: { include: { service: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findUnpaid(): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        isPaid: false,
        status: AppointmentStatus.ATTENDED,
      },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async markAsNoShow(id: string): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        'Só é possível marcar como no-show agendamentos com status SCHEDULED',
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.NO_SHOW,
      },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
    });
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        'Só é possível editar agendamentos com status SCHEDULED',
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: dto.scheduledAt,
        notes: dto.notes,
      },
      include: {
        client: true,
        professional: true,
        services: { include: { service: true } },
      },
    });
  }

  async linkPayment(appointmentId: string, paymentId: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { isPaid: true },
    });
  }
}
