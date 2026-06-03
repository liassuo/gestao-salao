import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [InAppNotificationsModule, CashRegisterModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
