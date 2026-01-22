import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Controller('services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /services
   * Retorna todos os serviços ativos (público - usado pelo app mobile)
   */
  @Get()
  async findAll() {
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
   * GET /services/:id
   * Retorna um serviço específico
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.service.findUnique({
      where: { id },
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
   * POST /services
   * Cria um novo serviço (admin)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        duration: dto.duration,
      },
    });
  }

  /**
   * PATCH /services/:id
   * Atualiza um serviço (admin)
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * DELETE /services/:id
   * Desativa um serviço (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
