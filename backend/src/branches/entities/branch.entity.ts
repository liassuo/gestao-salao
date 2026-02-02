/**
 * Branch domain entity
 * Represents a physical branch (filial) of the salon
 * Professionals, transactions, and commissions are linked to branches
 */
export class Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
