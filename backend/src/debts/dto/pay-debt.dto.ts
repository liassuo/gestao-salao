/**
 * DTO for registering a payment towards a debt
 */
export class PayDebtDto {
  amount: number; // Amount to pay in cents
  registeredBy: string; // User ID who registered the payment
  notes?: string;
}
