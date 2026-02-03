import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto, AddOrderItemDto, QueryOrderDto } from './dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@Query() query: QueryOrderDto) {
    return this.ordersService.findAll(query);
  }

  @Get('pending')
  async findPending() {
    return this.ordersService.findPending();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Post(':id/items')
  async addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrderItemDto,
  ) {
    return this.ordersService.addItem(id, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.ordersService.removeItem(id, itemId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/pay')
  async pay(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.pay(id);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.cancel(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.ordersService.remove(id);
  }
}
