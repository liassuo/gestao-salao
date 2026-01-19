import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

/**
 * Appointments module
 * Manages appointment scheduling and tracking
 * Handles the complete appointment lifecycle
 *
 * Will need to import:
 * - ServicesModule (to calculate prices and durations)
 * - ProfessionalsModule (to validate availability)
 * - ClientsModule (to validate client)
 */
@Module({
  providers: [AppointmentsService],
  exports: [AppointmentsService], // Export for use in payments and debts modules
})
export class AppointmentsModule {}
