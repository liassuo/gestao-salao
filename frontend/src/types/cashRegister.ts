export interface CashRegister {
  id: string;
  date: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number; // centavos
  closingBalance?: number; // centavos
  totalCash: number; // centavos
  totalPix: number; // centavos
  totalCard: number; // centavos
  totalRevenue: number; // centavos
  discrepancy: number; // centavos (pode ser negativo)
  isOpen: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenCashRegisterPayload {
  openingBalance: number; // centavos
  notes?: string;
}

export interface CloseCashRegisterPayload {
  closingBalance: number; // centavos
  notes?: string;
}

export interface CashRegisterSummary {
  totalRevenue: number;
  totalCash: number;
  totalPix: number;
  totalCard: number;
  totalDiscrepancy: number;
  count: number;
}

export interface CashRegisterFilters {
  startDate?: string;
  endDate?: string;
}

// Labels para exibição
export const cashRegisterStatusLabels = {
  open: 'Aberto',
  closed: 'Fechado',
} as const;

export const cashRegisterStatusColors = {
  open: 'bg-blue-500/20 text-blue-500',
  closed: 'bg-zinc-500/20 text-zinc-400',
} as const;
