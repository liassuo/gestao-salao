import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new service
   */
  async create(dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        duration: dto.duration,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Find all services (optionally filter by active status)
   */
  async findAll(activeOnly: boolean = true) {
    const where = activeOnly ? { isActive: true } : {};

    return this.prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        isActive: true,
      },
    });
  }

  /**
   * Find active services only (for client app)
   */
  async findActive() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        duration: true,
      },
    });
  }

  /**
   * Find service by ID
   */
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        professionals: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            appointmentServices: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return service;
  }

  /**
   * Find multiple services by IDs
   */
  async findByIds(ids: string[]) {
    return this.prisma.service.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
      },
    });
  }

  /**
   * Calculate total price and duration for multiple services
   */
  async calculateTotal(
    serviceIds: string[],
  ): Promise<{ totalPrice: number; totalDuration: number }> {
    const services = await this.prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        isActive: true,
      },
      select: {
        price: true,
        duration: true,
      },
    });

    return services.reduce(
      (acc, service) => ({
        totalPrice: acc.totalPrice + service.price,
        totalDuration: acc.totalDuration + service.duration,
      }),
      { totalPrice: 0, totalDuration: 0 },
    );
  }

  /**
   * Update service information
   */
  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return this.prisma.service.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft delete service
   */
  async remove(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get service statistics
   */
  async getStatistics(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        _count: {
          select: {
            appointmentServices: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    // Calculate revenue from this service
    const appointments = await this.prisma.appointmentService.findMany({
      where: { serviceId: id },
      include: {
        appointment: {
          select: {
            status: true,
            isPaid: true,
          },
        },
      },
    });

    const attendedCount = appointments.filter(
      (a) => a.appointment.status === 'ATTENDED',
    ).length;

    const revenue = attendedCount * service.price;

    return {
      ...service,
      attendedCount,
      totalRevenue: revenue,
    };
  }
}
