import {
  Controller, Get, Post, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateStockMovementDto, QueryStockMovementDto } from './dto';

@ApiTags('Stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  async findAll(@Query() query: QueryStockMovementDto) {
    return this.stockService.findAll(query);
  }

  @Get('movements/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stockService.findOne(id);
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateStockMovementDto) {
    return this.stockService.create(dto);
  }
}
