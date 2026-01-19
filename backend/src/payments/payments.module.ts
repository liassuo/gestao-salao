import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/**
 * Payments module
 * Manages REGISTRATION of payments (not processing)
 *
 * IMPORTANT: This module does NOT process payments
 * Payments are manually registered by staff for tracking purposes
 *
 * Will need to import:
 * - AppointmentsModule (to link payments to appointments)
 * - DebtsModule (to settle debts)
 */
@Module({
  providers: [PaymentsService],
  exports: [PaymentsService], // Export for use in cash-register module
})
export class PaymentsModule {}
