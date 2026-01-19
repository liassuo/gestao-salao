import { PaymentMethod } from '@common/enums';

/**
 * DTO for updating payment information
 * Useful for corrections
 * All fields are optional
 */
export class UpdatePaymentDto {
  amount?: number;
  method?: PaymentMethod;
  paidAt?: Date;
  notes?: string;
}
