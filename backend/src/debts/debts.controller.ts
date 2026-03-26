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

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Debts')
@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDebtDto: CreateDebtDto) {
    return this.debtsService.createDebt(createDebtDto);
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
    return this.debtsService.settleDebt(id, body?.method);
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
