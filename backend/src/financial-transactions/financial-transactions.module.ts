import { Module } from '@nestjs/common';
import { FinancialTransactionsController } from './financial-transactions.controller';
import { FinancialTransactionsService } from './financial-transactions.service';

@Module({
  controllers: [FinancialTransactionsController],
  providers: [FinancialTransactionsService],
  exports: [FinancialTransactionsService],
})
export class FinancialTransactionsModule {}
