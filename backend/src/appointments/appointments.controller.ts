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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CreateClientAppointmentDto,
  CreateTimeBlockDto,
  UpdateAppointmentDto,
  QueryAppointmentDto,
} from './dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly notificationsService: NotificationsService,
    private readonly inAppNotificationsService: InAppNotificationsService,
    private readonly subscriptionsService: SubscriptionsService,
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
    const appointment = await this.appointmentsService.create(createAppointmentDto);

    // Notificar admins sobre novo agendamento (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'appointment_created',
      title: 'Novo agendamento',
      message: `Agendamento criado para ${new Date(appointment.scheduledAt).toLocaleDateString('pt-BR')} às ${new Date(appointment.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      action_url: '/agendamentos',
      entity_type: 'appointment',
      entity_id: appointment.id,
    }).catch(() => {});

    return appointment;
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
    // Combina data e hora sem conversão de timezone
    const timeWithSeconds = dto.startTime.length === 5 ? `${dto.startTime}:00` : dto.startTime;
    const scheduledAt = `${dto.date}T${timeWithSeconds}`;

    const appointment = await this.appointmentsService.create({
      clientId: req.user.id,
      professionalId: dto.professionalId,
      serviceIds: dto.serviceIds,
      scheduledAt: scheduledAt as any,
      notes: dto.notes,
      billingType: dto.billingType,
      useSubscriptionCut: dto.useSubscriptionCut === true,
      source: 'CLIENT',
    });

    // Usar crédito de assinatura se solicitado
    if (dto.useSubscriptionCut) {
      const subscription = await this.subscriptionsService.getMySubscription(req.user.id);
      if (subscription) {
        await this.subscriptionsService.useCut(subscription.id);
      }
    }

    // Push notification (fire-and-forget)
    this.notificationsService.notifyNewBooking(appointment).catch(() => {});

    // In-app notification para admins (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'appointment_created',
      title: 'Novo agendamento pelo app',
      message: `Cliente agendou para ${new Date(scheduledAt).toLocaleDateString('pt-BR')} às ${new Date(scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      actor_id: req.user.id,
      action_url: '/agendamentos',
      entity_type: 'appointment',
      entity_id: appointment.id,
      group_key: `appointment_created`,
      anti_spam: 'aggregate',
    }).catch(() => {});

    return appointment;
  }

  @Get()
  async findAll(@Query() query: QueryAppointmentDto) {
    return this.appointmentsService.findAll(query);
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
    const result = await this.appointmentsService.cancel(id);

    // Notificar admins sobre cancelamento (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'appointment_canceled',
      title: 'Agendamento cancelado',
      message: `Um agendamento foi cancelado`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      action_url: '/agendamentos',
      entity_type: 'appointment',
      entity_id: id,
    }).catch(() => {});

    return result;
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
   * GET /appointments/:id/pending-pix
   * Cliente recupera QR Code PIX de um agendamento com pagamento pendente
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/pending-pix')
  async getPendingPixQrCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.appointmentsService.getPendingPixQrCode(id, req.user.id);
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
