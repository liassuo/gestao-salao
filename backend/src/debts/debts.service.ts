import { Injectable } from '@nestjs/common';
import { Debt } from './entities/debt.entity';
import { CreateDebtDto, UpdateDebtDto, PayDebtDto } from './dto';

/**
 * Debts service
 * Handles business logic for debt management ("fiado")
 *
 * IMPORTANT:
 * - Debts are independent of payment method
 * - A client can have multiple outstanding debts
 * - Partial payments are supported
 */
@Injectable()
export class DebtsService {
  // TODO: Implement in-memory storage or database integration later
  // Will need to inject ClientsService and PaymentsService

  /**
   * Create a new debt
   * Should update client's hasDebts flag
   */
  async create(createDebtDto: CreateDebtDto): Promise<Debt> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find all debts
   * May include filtering by status (settled/outstanding)
   */
  async findAll(): Promise<Debt[]> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find outstanding debts only
   * Used for debt management dashboard
   */
  async findOutstanding(): Promise<Debt[]> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find debts by client
   * Used for client debt history
   */
  async findByClient(clientId: string): Promise<Debt[]> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find outstanding debts by client
   * Used for checking if client has active debts
   */
  async findOutstandingByClient(clientId: string): Promise<Debt[]> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Calculate total outstanding debt for a client
   */
  async calculateClientTotalDebt(clientId: string): Promise<number> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find debt by ID
   */
  async findOne(id: string): Promise<Debt> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Register a payment towards a debt
   * Supports partial payments
   * If payment covers remaining balance, marks debt as settled
   */
  async registerPayment(id: string, payDebtDto: PayDebtDto): Promise<Debt> {
    // Implementation pending
    // Should:
    // - Update amountPaid
    // - Recalculate remainingBalance
    // - If remainingBalance = 0, set isSettled = true and paidAt = now
    // - Create a Payment record
    // - Update client's hasDebts flag if no more debts
    throw new Error('Not implemented');
  }

  /**
   * Update debt information
   */
  async update(id: string, updateDebtDto: UpdateDebtDto): Promise<Debt> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Delete debt
   * Should only be used for corrections
   * Should update client's hasDebts flag
   */
  async remove(id: string): Promise<void> {
    // Implementation pending
    throw new Error('Not implemented');
  }
}
