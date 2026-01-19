import { PaymentMethod } from '@common/enums';

/**
 * Payment domain entity
 * Represents a REGISTERED payment (not processed)
 *
 * CRITICAL RULES:
 * - This system does NOT process payments
 * - This system does NOT integrate with payment gateways
 * - Payments are MANUALLY REGISTERED by staff
 * - Payment methods are for TRACKING ONLY
 */
export class Payment {
  id: string;

  /**
   * Optional: Link to appointment if payment is for a service
   * Can be null if payment is for a debt settlement
   */
  appointmentId?: string;

  /**
   * Client who made the payment
   */
  clientId: string;

  /**
   * Amount paid in cents
   */
  amount: number;

  /**
   * Payment method used
   * For tracking purposes only - NOT for processing
   */
  method: PaymentMethod;

  /**
   * When the payment was received
   */
  paidAt: Date;

  /**
   * Who registered the payment
   */
  registeredBy: string; // User ID

  /**
   * Additional notes
   */
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
