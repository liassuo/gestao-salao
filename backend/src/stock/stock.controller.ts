import {
  Controller, Get, Post, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { StockService } from './stock.service';
import { CreateStockMovementDto, QueryStockMovementDto } from './dto';

@ApiTags('Stock')
@ApiBearerAuth()
// Estoque = operação do salão → só ADMIN.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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
