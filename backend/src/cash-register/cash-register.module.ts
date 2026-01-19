import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';

/**
 * Cash Register module
 * Manages daily cash register operations
 * Handles opening, closing, and revenue tracking
 *
 * Will need to import:
 * - PaymentsModule (to calculate daily totals)
 */
@Module({
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
