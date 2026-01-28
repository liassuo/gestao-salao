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
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * GET /services
   * Returns all active services (public - used by mobile app)
   */
  @Get()
  async findAll(@Query('all') all?: string) {
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
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  /**
   * PATCH /services/:id
   * Updates a service (admin)
   */
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
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.servicesService.remove(id);
  }
}
