import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AsaasModule } from '../asaas/asaas.module';
import { StockModule } from '../stock/stock.module';
import { ProfessionalDebtsModule } from '../professional-debts/professional-debts.module';

@Module({
  imports: [AsaasModule, StockModule, ProfessionalDebtsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
