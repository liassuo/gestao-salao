/**
 * Cash Register domain entity
 * Represents a daily cash register session
 * Used for opening/closing the register and tracking daily revenue
 */
export class CashRegister {
  id: string;

  /**
   * Date of this cash register session
   * Should be normalized to start of day (00:00:00)
   */
  date: Date;

  /**
   * When the register was opened
   */
  openedAt: Date;

  /**
   * Initial cash amount in cents
   * Money already in the register at opening
   */
  openingBalance: number;

  /**
   * User who opened the register
   */
  openedBy: string; // User ID

  /**
   * When the register was closed
   * Null if still open
   */
  closedAt?: Date;

  /**
   * Final cash amount in cents
   * Money in the register at closing
   */
  closingBalance?: number;

  /**
   * User who closed the register
   */
  closedBy?: string; // User ID

  /**
   * Total revenue for the day by payment method (in cents)
   * Calculated from payments during this session
   */
  totalCash?: number;
  totalPix?: number;
  totalCard?: number;

  /**
   * Total revenue for all methods combined
   */
  totalRevenue?: number;

  /**
   * Difference between expected and actual closing balance
   * Positive = surplus, Negative = deficit
   */
  discrepancy?: number;

  /**
   * Notes about the session
   */
  notes?: string;

  /**
   * Status flag
   */
  isOpen: boolean;

  createdAt: Date;
  updatedAt: Date;
}
