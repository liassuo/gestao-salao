import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  QueryAppointmentDto,
} from './dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get()
  async findAll(@Query() query: QueryAppointmentDto) {
    // Se tem filtro por profissional e datas, usa método específico
    if (query.professionalId && query.startDate && query.endDate) {
      return this.appointmentsService.findByProfessionalAndDate(
        query.professionalId,
        new Date(query.startDate),
        new Date(query.endDate),
      );
    }

    // Se tem filtro por cliente
    if (query.clientId) {
      return this.appointmentsService.findByClient(query.clientId);
    }

    // Sem filtros, retorna todos
    return this.appointmentsService.findAll();
  }

  @Get('unpaid')
  async findUnpaid() {
    return this.appointmentsService.findUnpaid();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, updateAppointmentDto);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.cancel(id);
  }

  @Patch(':id/attend')
  async markAsAttended(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.markAsAttended(id);
  }

  @Patch(':id/no-show')
  async markAsNoShow(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.markAsNoShow(id);
  }
}
