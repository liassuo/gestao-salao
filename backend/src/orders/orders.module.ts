import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AsaasModule } from '../asaas/asaas.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [AsaasModule, StockModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
