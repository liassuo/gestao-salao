import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [CommissionsModule, CashRegisterModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
