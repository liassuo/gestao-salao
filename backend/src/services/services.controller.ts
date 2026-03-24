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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * GET /services
   * Returns all active services (public - used by mobile app)
   */
  @Get()
  async findAll(
    @Query('all') all?: string,
    @Query('isActive') isActive?: string,
  ) {
    if (isActive !== undefined) {
      return this.servicesService.findAll(true, isActive === 'true');
    }
    const activeOnly = all !== 'true';
    return this.servicesService.findAll(activeOnly);
  }

  /**
   * GET /services/active
   * Returns only active services for client app
   */
  @Get('active')
  async findActive() {
    return this.servicesService.findActive();
  }

  /**
   * POST /services/calculate
   * Calculates total price and duration for selected services
   */
  @Post('calculate')
  async calculateTotal(@Body() body: { serviceIds: string[] }) {
    return this.servicesService.calculateTotal(body.serviceIds);
  }

  /**
   * GET /services/:id
   * Returns a specific service
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  /**
   * GET /services/:id/statistics
   * Returns service statistics
   */
  @Get(':id/statistics')
  async getStatistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.getStatistics(id);
  }

  /**
   * POST /services
   * Creates a new service (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  /**
   * PATCH /services/:id
   * Updates a service (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  /**
   * DELETE /services/:id
   * Soft deletes a service
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.servicesService.remove(id);
  }

  /**
   * DELETE /services/:id/permanent
   * Permanently deletes a service
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    await this.servicesService.hardDelete(id);
  }
}
