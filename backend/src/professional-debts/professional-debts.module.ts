import { Module } from '@nestjs/common';
import { ProfessionalDebtsController } from './professional-debts.controller';
import { ProfessionalDebtsService } from './professional-debts.service';

@Module({
  controllers: [ProfessionalDebtsController],
  providers: [ProfessionalDebtsService],
  exports: [ProfessionalDebtsService],
})
export class ProfessionalDebtsModule {}
