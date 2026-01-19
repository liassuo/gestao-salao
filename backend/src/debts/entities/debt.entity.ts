/**
 * Debt domain entity
 * Represents money owed by clients ("fiado")
 *
 * IMPORTANT RULES:
 * - Debts are INDEPENDENT of payment method
 * - A client can owe money regardless of how they usually pay
 * - Debt tracking is separate from appointment payment status
 * - Multiple debts can exist for the same client
 */
export class Debt {
  id: string;

  /**
   * Client who owes money
   */
  clientId: string;

  /**
   * Optional: Link to appointment that created this debt
   */
  appointmentId?: string;

  /**
   * Amount owed in cents
   */
  amount: number;

  /**
   * Amount already paid towards this debt in cents
   */
  amountPaid: number;

  /**
   * Remaining balance in cents
   * Calculated as: amount - amountPaid
   */
  remainingBalance: number;

  /**
   * Description or reason for the debt
   */
  description?: string;

  /**
   * When the debt was created
   */
  createdAt: Date;

  /**
   * Due date (optional)
   */
  dueDate?: Date;

  /**
   * When the debt was fully paid
   * Null if still outstanding
   */
  paidAt?: Date;

  /**
   * Status flag
   */
  isSettled: boolean;

  updatedAt: Date;
}
