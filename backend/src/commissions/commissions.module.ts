import { Module } from '@nestjs/common';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { ProfessionalDebtsModule } from '../professional-debts/professional-debts.module';

@Module({
  imports: [ProfessionalDebtsModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
