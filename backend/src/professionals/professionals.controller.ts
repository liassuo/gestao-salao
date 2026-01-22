import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto';

@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /professionals
   * Retorna todos os profissionais ativos (público - usado pelo app mobile)
   * Pode filtrar por serviceId
   */
  @Get()
  async findAll(@Query('serviceId') serviceId?: string) {
    const where: any = { isActive: true };

    // Se filtrar por serviço, busca profissionais que oferecem esse serviço
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
   * GET /professionals/:id
   * Retorna um profissional específico
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.professional.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
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
   * POST /professionals
   * Cria um novo profissional (admin)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProfessionalDto) {
    return this.prisma.professional.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        commissionRate: dto.commissionRate,
        workingHours: dto.workingHours,
      },
    });
  }

  /**
   * PATCH /professionals/:id
   * Atualiza um profissional (admin)
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.prisma.professional.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * DELETE /professionals/:id
   * Desativa um profissional (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.professional.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
