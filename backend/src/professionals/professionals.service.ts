import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto';

interface WorkingHours {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new professional
   */
  async create(dto: CreateProfessionalDto) {
    return this.prisma.professional.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        commissionRate: dto.commissionRate,
        workingHours: dto.workingHours || [],
        services: dto.serviceIds?.length
          ? { connect: dto.serviceIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        services: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Find all professionals with optional service filter
   */
  async findAll(serviceId?: string) {
    const where: any = { isActive: true };

    if (serviceId) {
      where.services = {
        some: { id: serviceId },
      };
    }

    return this.prisma.professional.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        commissionRate: true,
        workingHours: true,
        isActive: true,
        services: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Find active professionals only (for appointment booking)
   */
  async findActive() {
    return this.prisma.professional.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        services: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Find professional by ID
   */
  async findOne(id: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        commissionRate: true,
        workingHours: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        services: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    return professional;
  }

  /**
   * Find professionals who can perform a specific service
   */
  async findByService(serviceId: string) {
    return this.prisma.professional.findMany({
      where: {
        isActive: true,
        services: {
          some: { id: serviceId },
        },
      },
      select: {
        id: true,
        name: true,
        workingHours: true,
      },
    });
  }

  /**
   * Check if professional is available at a given time
   */
  async isAvailable(
    professionalId: string,
    dateTime: Date,
    duration: number,
  ): Promise<boolean> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { workingHours: true, isActive: true },
    });

    if (!professional || !professional.isActive) {
      return false;
    }

    // Check working hours
    const dayOfWeek = dateTime.getDay();
    const workingHours = professional.workingHours as unknown as WorkingHours[] | null;

    if (workingHours && workingHours.length > 0) {
      const daySchedule = workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
      if (!daySchedule) {
        return false; // Professional doesn't work on this day
      }

      const timeStr = dateTime.toTimeString().slice(0, 5); // HH:MM
      const endTime = new Date(dateTime.getTime() + duration * 60000);
      const endTimeStr = endTime.toTimeString().slice(0, 5);

      if (timeStr < daySchedule.startTime || endTimeStr > daySchedule.endTime) {
        return false; // Outside working hours
      }
    }

    // Check for conflicting appointments
    const endDateTime = new Date(dateTime.getTime() + duration * 60000);

    const conflictingAppointments = await this.prisma.appointment.count({
      where: {
        professionalId,
        status: 'SCHEDULED',
        OR: [
          {
            AND: [
              { scheduledAt: { lte: dateTime } },
              {
                scheduledAt: {
                  gte: new Date(dateTime.getTime() - 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
        ],
        // More precise conflict detection would need totalDuration
      },
    });

    // Simplified check - a more robust implementation would calculate exact time slots
    return conflictingAppointments === 0;
  }

  /**
   * Update professional information
   */
  async update(id: string, dto: UpdateProfessionalDto) {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const { serviceIds, ...data } = dto;

    return this.prisma.professional.update({
      where: { id },
      data: {
        ...data,
        services: serviceIds
          ? { set: serviceIds.map((sid) => ({ id: sid })) }
          : undefined,
      },
      include: {
        services: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete professional
   */
  async remove(id: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    await this.prisma.professional.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get professional's appointments for a specific date
   */
  async getAppointmentsByDate(professionalId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.appointment.findMany({
      where: {
        professionalId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['SCHEDULED', 'ATTENDED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        totalDuration: true,
        status: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}
