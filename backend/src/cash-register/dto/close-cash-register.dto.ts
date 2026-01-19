/**
 * DTO for closing the cash register
 */
export class CloseCashRegisterDto {
  closingBalance: number; // Closing balance in cents
  closedBy: string; // User ID
  notes?: string;
}
