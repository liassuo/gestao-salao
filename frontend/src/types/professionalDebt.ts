export type ProfessionalDebtStatus =
  | 'PENDING'
  | 'DEDUCTED'
  | 'SETTLED_CASH'
  | 'VOIDED';

export interface ProfessionalDebt {
  id: string;
  professionalId: string;
  orderId?: string | null;
  amount: number;            // centavos
  amountPaid: number;        // centavos
  remainingBalance: number;  // centavos
  description?: string;
  status: ProfessionalDebtStatus;
  deductedFromCommissionId?: string | null;
  settledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  professional?: { id: string; name: string };
  order?: { id: string; totalAmount: number; status: string };
}

export interface CreateProfessionalDebtPayload {
  professionalId: string;
  amount: number;            // centavos
  description?: string;
}

export interface SettleProfessionalDebtCashPayload {
  amount?: number;           // centavos (opcional — quita saldo total se omitido)
  method?: 'CASH' | 'PIX' | 'CARD';
  registeredBy?: string;
}

export interface ProfessionalDebtSummary {
  professionalId: string;
  totalPending: number;
  pendingCount: number;
  totalAll: number;
  totalPaid: number;
}

export interface ProfessionalDebtFilters {
  professionalId?: string;
  status?: ProfessionalDebtStatus;
}

export const professionalDebtStatusLabels: Record<ProfessionalDebtStatus, string> = {
  PENDING: 'Pendente',
  DEDUCTED: 'Descontado em comissão',
  SETTLED_CASH: 'Quitado em dinheiro',
  VOIDED: 'Anulado',
};

export const professionalDebtStatusColors: Record<ProfessionalDebtStatus, string> = {
  PENDING: 'bg-red-500/20 text-red-400',
  DEDUCTED: 'bg-blue-500/20 text-blue-400',
  SETTLED_CASH: 'bg-green-500/20 text-green-400',
  VOIDED: 'bg-zinc-500/20 text-zinc-400',
};
