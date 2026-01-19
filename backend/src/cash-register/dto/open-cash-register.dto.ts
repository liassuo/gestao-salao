/**
 * DTO for opening the cash register
 */
export class OpenCashRegisterDto {
  date: Date; // Date of this session
  openingBalance: number; // Opening balance in cents
  openedBy: string; // User ID
  notes?: string;
}
