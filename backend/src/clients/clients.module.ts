import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { AsaasModule } from '../asaas/asaas.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

/**
 * Clients module
 * Manages customers who book appointments via the app
 * Handles client registration, authentication, and profile management
 */
@Module({
  imports: [AsaasModule, InAppNotificationsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}

