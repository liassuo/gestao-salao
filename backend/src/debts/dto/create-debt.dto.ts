/**
 * DTO for creating a new debt
 */
export class CreateDebtDto {
  clientId: string;
  appointmentId?: string;
  amount: number; // Amount in cents
  description?: string;
  dueDate?: Date;
}
