import { Module } from '@nestjs/common';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { AsaasModule } from '../asaas/asaas.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [AsaasModule, InAppNotificationsModule],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
