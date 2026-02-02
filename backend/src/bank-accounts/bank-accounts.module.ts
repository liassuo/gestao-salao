import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * BankAccounts module
 * Manages bank accounts used for financial transactions
 * Handles account registration, listing, and deactivation
 */
@Module({
  imports: [PrismaModule],
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
