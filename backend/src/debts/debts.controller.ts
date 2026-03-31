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
import { DebtsService } from './debts.service';
import { CreateDebtDto, UpdateDebtDto, PayDebtDto, QueryDebtDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Debts')
@Controller('debts')
export class DebtsController {
  constructor(
    private readonly debtsService: DebtsService,
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDebtDto: CreateDebtDto) {
    const debt = await this.debtsService.createDebt(createDebtDto);

    // Notificar admins sobre nova dívida (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'debt_created',
      title: 'Nova dívida registrada',
      message: `Dívida de R$ ${Number(createDebtDto.amount || 0).toFixed(2)} registrada`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      action_url: '/dividas',
      entity_type: 'debt',
      entity_id: debt?.id,
    }).catch(() => {});

    return debt;
  }

  @Get()
  async findAll(@Query() query: QueryDebtDto) {
    // Se tem filtro por cliente e status
    if (query.clientId && query.isSettled === 'false') {
      return this.debtsService.findOutstandingByClient(query.clientId);
    }

    // Se tem filtro por cliente
    if (query.clientId) {
      return this.debtsService.findByClient(query.clientId);
    }

    // Se quer apenas dívidas em aberto
    if (query.isSettled === 'false') {
      return this.debtsService.findOutstanding();
    }

    // Sem filtros, retorna todas
    return this.debtsService.findAll();
  }

  @Get('outstanding')
  async findOutstanding() {
    return this.debtsService.findOutstanding();
  }

  @Get('client/:clientId/total')
  async getClientTotal(@Param('clientId', ParseUUIDPipe) clientId: string) {
    const total = await this.debtsService.calculateClientTotalDebt(clientId);
    return { clientId, totalDebt: total };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyOutstandingDebts(@Req() req: RequestWithUser) {
    const debts = await this.debtsService.findOutstandingByClient(req.user.id);
    const total = debts.reduce((sum: number, d: any) => sum + d.remainingBalance, 0);
    return { debts, total };
  }

  @UseGuards(JwtAuthGuard)
  @Post('my/pay-pix')
  @HttpCode(HttpStatus.CREATED)
  async payMyDebtsViaPix(@Req() req: RequestWithUser) {
    return this.debtsService.createPixChargeForDebts(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.findOne(id);
  }

  @Post(':id/partial-payment')
  async registerPartialPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payDebtDto: PayDebtDto,
  ) {
    return this.debtsService.registerPartialPayment(id, payDebtDto);
  }

  @Patch(':id/settle')
  async settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { method?: string },
  ) {
    const result = await this.debtsService.settleDebt(id, body?.method);

    // Notificar admins sobre dívida quitada (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'debt_paid',
      title: 'Dívida quitada',
      message: `Uma dívida foi quitada`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      action_url: '/dividas',
      entity_type: 'debt',
      entity_id: id,
    }).catch(() => {});

    return result;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDebtDto: UpdateDebtDto,
  ) {
    return this.debtsService.update(id, updateDebtDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.debtsService.remove(id);
  }
}
