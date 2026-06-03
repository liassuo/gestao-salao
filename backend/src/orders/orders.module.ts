import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AsaasModule } from '../asaas/asaas.module';
import { StockModule } from '../stock/stock.module';
import { ProfessionalDebtsModule } from '../professional-debts/professional-debts.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [AsaasModule, StockModule, ProfessionalDebtsModule, CashRegisterModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
