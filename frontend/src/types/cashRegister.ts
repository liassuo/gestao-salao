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
  totalSubscriptions?: number; // centavos — faturamento vindo de planos/assinaturas (recortado por payment.subscriptionId)
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
  daysCount: number;
}

export interface CashRegisterFilters {
  startDate?: string;
  endDate?: string;
}

export interface CashRegisterTransactionItem {
  name: string;
  quantity: number;
  unitPrice: number; // centavos
}

export interface CashRegisterTransaction {
  id: string;
  paidAt: string;
  businessDate?: string | null;
  amount: number; // centavos
  method: string; // CASH | PIX | CARD | BOLETO
  clientName?: string | null;
  professionalName?: string | null;
  isSubscription: boolean;
  items: CashRegisterTransactionItem[];
}

export interface CashRegisterTransactions {
  date: string;
  count: number;
  total: number; // centavos
  transactions: CashRegisterTransaction[];
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
