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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto, QueryPaymentDto } from './dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    const payment = await this.paymentsService.registerPayment(createPaymentDto);

    // Notificar admins sobre pagamento recebido (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'payment_received',
      title: 'Pagamento registrado',
      message: `Pagamento de R$ ${Number(createPaymentDto.amount || 0).toFixed(2)} registrado`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      action_url: '/pagamentos',
      entity_type: 'payment',
      entity_id: payment?.id,
      group_key: 'payment_received',
      anti_spam: 'aggregate',
    }).catch(() => {});

    return payment;
  }

  @Get()
  async findAll(@Query() query: QueryPaymentDto) {
    // Se tem filtro por período
    if (query.startDate && query.endDate) {
      return this.paymentsService.findByDateRange(
        `${query.startDate}T00:00:00`,
        `${query.endDate}T23:59:59`,
      );
    }

    // Se tem filtro por cliente
    if (query.clientId) {
      return this.paymentsService.findByClient(query.clientId);
    }

    // Se tem filtro por método
    if (query.method) {
      return this.paymentsService.findByMethod(query.method);
    }

    // Sem filtros, retorna todos
    return this.paymentsService.findAll();
  }

  @Get('totals')
  async getTotals(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return this.paymentsService.calculateTotalsByMethod(
        `${todayStr}T00:00:00`,
        `${todayStr}T23:59:59`,
      );
    }

    return this.paymentsService.calculateTotalsByMethod(
      `${startDate}T00:00:00`,
      `${endDate}T23:59:59`,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.paymentsService.unlinkPayment(id);
  }
}
