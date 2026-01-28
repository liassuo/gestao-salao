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
import { ApiTags } from '@nestjs/swagger';
import { CashRegisterService } from './cash-register.service';
import {
  OpenCashRegisterDto,
  CloseCashRegisterDto,
  QueryCashRegisterDto,
} from './dto';

@ApiTags('Cash Register')
@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  async open(@Body() openCashRegisterDto: OpenCashRegisterDto) {
    return this.cashRegisterService.openRegister(openCashRegisterDto);
  }

  @Patch(':id/close')
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() closeCashRegisterDto: CloseCashRegisterDto,
  ) {
    return this.cashRegisterService.closeRegister(id, closeCashRegisterDto);
  }

  @Get('today')
  async getToday() {
    const register = await this.cashRegisterService.getTodayRegister();
    return register ?? { message: 'Nenhum caixa aberto hoje' };
  }

  @Get('open')
  async findOpen() {
    const register = await this.cashRegisterService.findOpen();
    return register ?? { message: 'Nenhum caixa aberto' };
  }

  @Get('summary')
  async getSummary(@Query() query: QueryCashRegisterDto) {
    if (!query.startDate || !query.endDate) {
      // Se não informado, usa o mês atual
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      return this.cashRegisterService.getSummary(startDate, endDate);
    }

    return this.cashRegisterService.getSummary(
      new Date(query.startDate),
      new Date(query.endDate),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashRegisterService.findOne(id);
  }

  @Get()
  async findAll(@Query() query: QueryCashRegisterDto) {
    // Se tem filtro por período, busca por data
    if (query.startDate) {
      return this.cashRegisterService.findByDate(new Date(query.startDate));
    }

    // Sem filtros, retorna todos
    return this.cashRegisterService.findAll();
  }
}
