import { PaymentMethod } from '@common/enums';

/**
 * DTO for registering a new payment
 */
export class CreatePaymentDto {
  appointmentId?: string;
  clientId: string;
  amount: number; // Amount in cents
  method: PaymentMethod;
  paidAt: Date;
  registeredBy: string; // User ID
  notes?: string;
}
