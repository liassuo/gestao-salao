/**
 * DTO for updating debt information
 * All fields are optional
 */
export class UpdateDebtDto {
  amount?: number;
  description?: string;
  dueDate?: Date;
}
