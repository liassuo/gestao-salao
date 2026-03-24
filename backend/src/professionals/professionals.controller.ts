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
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ProfessionalsService } from './professionals.service';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto';

@ApiTags('Professionals')
@ApiBearerAuth()
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  /**
   * GET /professionals
   * Returns all active professionals (public - used by mobile app)
   * Can filter by serviceId
   */
  @Get()
  async findAll(
    @Query('serviceId') serviceId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveValue = isActive !== undefined ? isActive === 'true' : undefined;
    return this.professionalsService.findAll(serviceId, isActiveValue);
  }

  /**
   * GET /professionals/active
   * Returns only active professionals for booking
   */
  @Get('active')
  async findActive() {
    return this.professionalsService.findActive();
  }

  /**
   * GET /professionals/available-for-booking?serviceIds=id1,id2&date=2026-03-06
   * Returns professionals that can perform the selected services on the given date
   */
  @Get('available-for-booking')
  async findAvailableForBooking(
    @Query('serviceIds') serviceIds: string,
    @Query('date') date: string,
  ) {
    const ids = serviceIds.split(',').filter(Boolean);
    return this.professionalsService.findAvailableForBooking(ids, date);
  }

  /**
   * GET /professionals/by-service/:serviceId
   * Returns professionals who can perform a specific service
   */
  @Get('by-service/:serviceId')
  async findByService(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.professionalsService.findByService(serviceId);
  }

  /**
   * GET /professionals/:id
   * Returns a specific professional
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findOne(id);
  }

  /**
   * GET /professionals/:id/appointments
   * Returns professional's appointments for a specific date
   */
  @Get(':id/appointments')
  async getAppointments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') dateStr?: string,
  ) {
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.professionalsService.getAppointmentsByDate(id, date);
  }

  /**
   * POST /professionals
   * Creates a new professional (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProfessionalDto) {
    return this.professionalsService.create(dto);
  }

  /**
   * POST /professionals/upload-avatar
   * Uploads a professional avatar image
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.professionalsService.uploadAvatar(file);
  }

  /**
   * PATCH /professionals/:id
   * Updates a professional (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.professionalsService.update(id, dto);
  }

  /**
   * DELETE /professionals/:id
   * Soft deletes a professional
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.professionalsService.remove(id);
  }

  /**
   * DELETE /professionals/:id/permanent
   * Permanently deletes a professional
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    await this.professionalsService.hardDelete(id);
  }
}
