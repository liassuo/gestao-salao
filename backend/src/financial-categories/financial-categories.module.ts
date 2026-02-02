import { Module } from '@nestjs/common';
import { FinancialCategoriesController } from './financial-categories.controller';
import { FinancialCategoriesService } from './financial-categories.service';

@Module({
  controllers: [FinancialCategoriesController],
  providers: [FinancialCategoriesService],
  exports: [FinancialCategoriesService],
})
export class FinancialCategoriesModule {}
