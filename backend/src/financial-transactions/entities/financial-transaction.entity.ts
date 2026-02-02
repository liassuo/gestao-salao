/**
 * FinancialTransaction domain entity
 * Represents financial movements (expenses and revenues)
 *
 * IMPORTANT RULES:
 * - amount is always in centavos (integer)
 * - netAmount is calculated: amount - (amount * discount/100) + (amount * interest/100)
 * - discount and interest are percentages (Decimal)
 * - type determines if it's EXPENSE or REVENUE
 * - status tracks the lifecycle: PENDING -> PAID / OVERDUE / CANCELED
 */
export class FinancialTransaction {
  id: string;

  /**
   * Transaction type: EXPENSE or REVENUE
   */
  type: string;

  /**
   * Description of the transaction
   */
  description: string;

  /**
   * Gross amount in centavos
   */
  amount: number;

  /**
   * Discount percentage (0-100)
   */
  discount?: number;

  /**
   * Interest percentage (0-100)
   */
  interest?: number;

  /**
   * Net amount in centavos after discount and interest
   * netAmount = amount - (amount * discount/100) + (amount * interest/100)
   */
  netAmount: number;

  /**
   * Payment condition: A_VISTA or A_PRAZO
   */
  paymentCondition: string;

  /**
   * Transaction status: PENDING, PAID, OVERDUE, CANCELED
   */
  status: string;

  /**
   * Whether this transaction recurs
   */
  isRecurring: boolean;

  /**
   * Due date for the transaction
   */
  dueDate: Date;

  /**
   * When the transaction was paid (null if not yet paid)
   */
  paidAt?: Date;

  /**
   * Additional notes
   */
  notes?: string;

  /**
   * Branch reference
   */
  branchId?: string;

  /**
   * Category reference (required)
   */
  categoryId: string;

  /**
   * Subcategory reference (optional)
   */
  subcategoryId?: string;

  /**
   * Bank account reference
   */
  bankAccountId?: string;

  /**
   * Payment method config reference
   */
  paymentMethodConfigId?: string;

  createdAt: Date;
  updatedAt: Date;
}
