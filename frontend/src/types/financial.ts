// =============================================
// Branch (Filial)
// =============================================

export interface Branch {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    professionals: number;
    commissions: number;
  };
}

export interface CreateBranchPayload {
  name: string;
  address?: string;
  phone?: string;
}

export interface UpdateBranchPayload {
  name?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

// =============================================
// BankAccount (Conta Bancaria)
// =============================================

export interface BankAccount {
  id: string;
  name: string;
  bank?: string | null;
  accountType?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountPayload {
  name: string;
  bank?: string;
  accountType?: string;
}

export interface UpdateBankAccountPayload {
  name?: string;
  bank?: string;
  accountType?: string;
  isActive?: boolean;
}

// =============================================
// PaymentMethodConfig (Forma de Pagamento)
// =============================================

export type PaymentCondition = 'A_VISTA' | 'A_PRAZO';
export type PaymentMethodScope = 'COMANDA' | 'EXPENSE' | 'BOTH';

export interface PaymentMethodConfig {
  id: string;
  name: string;
  type: PaymentCondition;
  scope: PaymentMethodScope;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodConfigPayload {
  name: string;
  type: PaymentCondition;
  scope: PaymentMethodScope;
}

export interface UpdatePaymentMethodConfigPayload {
  name?: string;
  type?: PaymentCondition;
  scope?: PaymentMethodScope;
  isActive?: boolean;
}

export interface PaymentMethodConfigFilters {
  scope?: PaymentMethodScope;
  type?: PaymentCondition;
  isActive?: boolean;
}

// =============================================
// Commission (Comissao)
// =============================================

export type CommissionStatus = 'PENDING' | 'PAID';

export interface Commission {
  id: string;
  amount: number; // centavos
  periodStart: string;
  periodEnd: string;
  status: CommissionStatus;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  professional: { id: string; name: string; commissionRate?: number | null };
  branch?: { id: string; name: string } | null;
}

export interface GenerateCommissionPayload {
  periodStart: string;
  periodEnd: string;
  branchId?: string;
}

export interface CommissionFilters {
  professionalId?: string;
  status?: CommissionStatus;
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

// =============================================
// Labels para exibicao
// =============================================

export const paymentConditionLabels: Record<PaymentCondition, string> = {
  A_VISTA: 'A vista',
  A_PRAZO: 'A prazo',
};

export const paymentMethodScopeLabels: Record<PaymentMethodScope, string> = {
  COMANDA: 'Comanda',
  EXPENSE: 'Despesa',
  BOTH: 'Ambos',
};

export const commissionStatusLabels: Record<CommissionStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
};

export const commissionStatusColors: Record<CommissionStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-500',
  PAID: 'bg-emerald-500/20 text-emerald-500',
};
