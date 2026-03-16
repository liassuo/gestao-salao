import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CreateClientAppointmentDto,
  CreateTimeBlockDto,
  UpdateAppointmentDto,
  QueryAppointmentDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from '../notifications/notifications.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * GET /appointments/me
   * Retorna agendamentos do cliente autenticado (app mobile)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMyAppointments(@Req() req: RequestWithUser) {
    return this.appointmentsService.findByClient(req.user.id);
  }

  /**
   * GET /appointments/available-slots
   * Retorna horários disponíveis para um profissional em uma data
   */
  @Get('available-slots')
  async getAvailableSlots(
    @Query('professionalId') professionalId: string,
    @Query('date') date: string,
    @Query('duration') duration?: string,
  ) {
    return this.appointmentsService.getAvailableSlots(
      professionalId,
      date,
      duration ? parseInt(duration, 10) : undefined,
    );
  }

  /**
   * GET /appointments/calendar?date=2026-02-03
   */
  @Get('calendar')
  async getCalendarData(@Query('date') date: string) {
    return this.appointmentsService.getCalendarData(date);
  }

  /**
   * POST /appointments/block
   */
  @Post('block')
  @HttpCode(HttpStatus.CREATED)
  async createTimeBlock(@Body() dto: CreateTimeBlockDto) {
    return this.appointmentsService.createTimeBlock(dto);
  }

  /**
   * DELETE /appointments/block/:id
   */
  @Delete('block/:id')
  async deleteTimeBlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.deleteTimeBlock(id);
  }

  /**
   * POST /appointments
   * Cria agendamento (admin/painel)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  /**
   * POST /appointments/client
   * Cria agendamento pelo app mobile (cliente autenticado)
   * clientId é extraído do token JWT
   */
  @UseGuards(JwtAuthGuard)
  @Post('client')
  @HttpCode(HttpStatus.CREATED)
  async createAsClient(
    @Req() req: RequestWithUser,
    @Body() dto: CreateClientAppointmentDto,
  ) {
    // Combina data e hora para criar o scheduledAt
    // startTime pode vir como "09:00" ou "09:00:00"
    const timeWithSeconds = dto.startTime.length === 5 ? `${dto.startTime}:00` : dto.startTime;
    const scheduledAt = new Date(`${dto.date}T${timeWithSeconds}`);

    const appointment = await this.appointmentsService.create({
      clientId: req.user.id,
      professionalId: dto.professionalId,
      serviceIds: dto.serviceIds,
      scheduledAt,
      notes: dto.notes,
    });

    // Notificar admin/profissional do novo agendamento (fire-and-forget)
    this.notificationsService.notifyNewBooking(appointment).catch(() => {});

    return appointment;
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

  /**
   * PATCH /appointments/:id/rate
   * Cliente avalia um agendamento atendido
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/rate')
  async rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: { rating: number; comment?: string },
  ) {
    return this.appointmentsService.rateAppointment(id, req.user.id, dto.rating, dto.comment);
  }
}
