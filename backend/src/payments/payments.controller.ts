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

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.registerPayment(createPaymentDto);
  }

  @Get()
  async findAll(@Query() query: QueryPaymentDto) {
    // Se tem filtro por período
    if (query.startDate && query.endDate) {
      return this.paymentsService.findByDateRange(
        new Date(query.startDate),
        new Date(query.endDate),
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
      // Se não informado, usa o dia atual
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return this.paymentsService.calculateTotalsByMethod(today, tomorrow);
    }

    return this.paymentsService.calculateTotalsByMethod(
      new Date(startDate),
      new Date(endDate),
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
