import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [NotificationsModule, InAppNotificationsModule, SubscriptionsModule, AsaasModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
