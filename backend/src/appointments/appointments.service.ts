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

  async getAvailableSlots(
    professionalId: string,
    date: string,
  ): Promise<{ time: string; available: boolean }[]> {
    // 1. Buscar profissional e seus horários de trabalho
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    // 2. Definir horários de trabalho padrão (8h às 18h) ou usar os do profissional
    const workingHours = professional.workingHours as Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }> | null;

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Horário padrão se não definido
    let startHour = 8;
    let endHour = 18;

    if (workingHours) {
      const todaySchedule = workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
      if (!todaySchedule) {
        // Profissional não trabalha neste dia
        return [];
      }
      startHour = parseInt(todaySchedule.startTime.split(':')[0], 10);
      endHour = parseInt(todaySchedule.endTime.split(':')[0], 10);
    }

    // 3. Buscar agendamentos do profissional no dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.ATTENDED] },
      },
    });

    // 4. Gerar slots de 30 minutos e verificar disponibilidade
    const slots: { time: string; available: boolean }[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      for (const minutes of [0, 30]) {
        const slotTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const slotDate = new Date(date);
        slotDate.setHours(hour, minutes, 0, 0);

        // Verificar se o slot já passou (para hoje)
        const now = new Date();
        if (slotDate < now) {
          slots.push({ time: slotTime, available: false });
          continue;
        }

        // Verificar conflito com agendamentos existentes
        const hasConflict = appointments.some((apt) => {
          const aptStart = new Date(apt.scheduledAt);
          const aptEnd = new Date(aptStart.getTime() + apt.totalDuration * 60 * 1000);
          return slotDate >= aptStart && slotDate < aptEnd;
        });

        slots.push({ time: slotTime, available: !hasConflict });
      }
    }

    return slots;
  }
}
