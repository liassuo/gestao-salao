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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { ProfessionalsService } from './professionals.service';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  /**
   * GET /professionals
   * Returns all active professionals (public - used by mobile app)
   * Can filter by serviceId
   */
  @Get()
  async findAll(@Query('serviceId') serviceId?: string) {
    return this.professionalsService.findAll(serviceId);
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
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProfessionalDto) {
    return this.professionalsService.create(dto);
  }

  /**
   * POST /professionals/upload-avatar
   * Uploads a professional avatar image
   */
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.professionalsService.uploadAvatar(file);
  }

  /**
   * PATCH /professionals/:id
   * Updates a professional (admin)
   */
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
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.professionalsService.remove(id);
  }
}
