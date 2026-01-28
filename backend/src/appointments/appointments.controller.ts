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
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CreateClientAppointmentDto,
  UpdateAppointmentDto,
  QueryAppointmentDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

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
  ) {
    return this.appointmentsService.getAvailableSlots(professionalId, date);
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
    console.log('=== CREATE APPOINTMENT CLIENT ===');
    console.log('User from token:', req.user);
    console.log('Body received:', dto);

    // Combina data e hora para criar o scheduledAt
    // startTime pode vir como "09:00" ou "09:00:00"
    const timeWithSeconds = dto.startTime.length === 5 ? `${dto.startTime}:00` : dto.startTime;
    const scheduledAt = new Date(`${dto.date}T${timeWithSeconds}`);

    console.log('scheduledAt:', scheduledAt);

    return this.appointmentsService.create({
      clientId: req.user.id,
      professionalId: dto.professionalId,
      serviceIds: dto.serviceIds,
      scheduledAt,
      notes: dto.notes,
    });
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
