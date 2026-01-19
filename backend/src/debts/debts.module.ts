import { Module } from '@nestjs/common';
import { DebtsService } from './debts.service';

/**
 * Debts module
 * Manages client debts ("fiado")
 * Tracks outstanding balances and payment history
 *
 * IMPORTANT: Debts are independent of payment method
 *
 * Will need to import:
 * - ClientsModule (to update hasDebts flag)
 * - PaymentsModule (to create payment records)
 */
@Module({
  providers: [DebtsService],
  exports: [DebtsService], // Export for use in other modules
})
export class DebtsModule {}
