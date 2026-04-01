import { CommissionStatus } from '../../common/enums';

/**
 * Commission domain entity
 * Represents a commission calculated for a professional based on attended appointments
 *
 * IMPORTANT RULES:
 * - Commissions are generated for a specific period (startDate to endDate)
 * - Amount is calculated as: sum of (appointment.totalPrice * professional.commissionRate / 100)
 * - Only ATTENDED appointments are considered
 * - Amount is stored in centavos (integer)
 * - Each commission record is per professional per period
 */
export class Commission {
  id: string;

  /**
   * Commission amount in centavos (total = amountServices + amountSubscription + amountProducts)
   */
  amount: number;

  /** Commission from standalone services (serviços avulsos) in centavos */
  amountServices: number;

  /** Commission from subscription services (serviços por assinatura) in centavos */
  amountSubscription: number;

  /** Commission from product sales (produtos) in centavos */
  amountProducts: number;

  /**
   * Start of the commission period
   */
  periodStart: Date;

  /**
   * End of the commission period
   */
  periodEnd: Date;

  /**
   * Commission payment status
   */
  status: CommissionStatus;

  /**
   * When the commission was paid to the professional
   * Null if still pending
   */
  paidAt?: Date;

  /**
   * Optional notes
   */
  notes?: string;

  /**
   * Professional who earned this commission
   */
  professionalId: string;

  /**
   * Optional: Branch where the appointments were performed
   */
  branchId?: string;

  createdAt: Date;
  updatedAt: Date;
}
