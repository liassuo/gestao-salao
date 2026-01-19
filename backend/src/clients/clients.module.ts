import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';

/**
 * Clients module
 * Manages customers who book appointments via the app
 * Handles client registration, authentication, and profile management
 */
@Module({
  providers: [ClientsService],
  exports: [ClientsService], // Export for use in appointments and debts modules
})
export class ClientsModule {}
