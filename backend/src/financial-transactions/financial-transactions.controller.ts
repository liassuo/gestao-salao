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
import { FinancialTransactionsService } from './financial-transactions.service';
import {
  CreateFinancialTransactionDto,
  UpdateFinancialTransactionDto,
  QueryFinancialTransactionDto,
} from './dto';

@ApiTags('FinancialTransactions')
@Controller('financial-transactions')
export class FinancialTransactionsController {
  constructor(
    private readonly financialTransactionsService: FinancialTransactionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateFinancialTransactionDto) {
    return this.financialTransactionsService.create(createDto);
  }

  @Get()
  async findAll(@Query() query: QueryFinancialTransactionDto) {
    return this.financialTransactionsService.findAll(query);
  }

  @Get('payable')
  async getPayable(@Query() query: QueryFinancialTransactionDto) {
    return this.financialTransactionsService.getPayableTotals(query);
  }

  @Get('receivable')
  async getReceivable(@Query() query: QueryFinancialTransactionDto) {
    return this.financialTransactionsService.getReceivableTotals(query);
  }

  @Get('balance')
  async getBalance(@Query() query: QueryFinancialTransactionDto) {
    return this.financialTransactionsService.getBalance(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialTransactionsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateFinancialTransactionDto,
  ) {
    return this.financialTransactionsService.update(id, updateDto);
  }

  @Patch(':id/pay')
  async markAsPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialTransactionsService.markAsPaid(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.financialTransactionsService.remove(id);
  }
}
