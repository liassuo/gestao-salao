export interface Debt {
  id: string;
  amount: number; // centavos - valor total
  amountPaid: number; // centavos - valor já pago
  remainingBalance: number; // centavos - saldo restante
  isSettled: boolean;
  description?: string;
  dueDate?: string;
  client: {
    id: string;
    name: string;
  };
  appointment?: {
    id: string;
    dateTime: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebtPayload {
  clientId: string;
  appointmentId?: string;
  amount: number; // centavos
  description?: string;
  dueDate?: string;
}

export interface PartialPaymentPayload {
  amount: number; // centavos
  method?: 'CASH' | 'PIX' | 'CARD' | 'BOLETO';
  notes?: string;
}

export interface DebtFilters {
  clientId?: string;
  isSettled?: boolean;
}

// Labels para exibição
export const debtStatusLabels = {
  open: 'Aberta',
  settled: 'Quitada',
} as const;

export const debtStatusColors = {
  open: 'bg-red-500/20 text-red-500',
  settled: 'bg-blue-500/20 text-blue-500',
} as const;
