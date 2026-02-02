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
    transactions: number;
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
  _count?: {
    transactions: number;
  };
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
// FinancialCategory (Categoria Financeira)
// =============================================

export type TransactionType = 'EXPENSE' | 'REVENUE';

export interface FinancialCategory {
  id: string;
  name: string;
  type: TransactionType;
  isActive: boolean;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  children?: FinancialCategory[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    transactions: number;
    subTransactions: number;
    children: number;
  };
}

export interface CreateFinancialCategoryPayload {
  name: string;
  type: TransactionType;
  parentId?: string;
}

export interface UpdateFinancialCategoryPayload {
  name?: string;
  type?: TransactionType;
  parentId?: string | null;
  isActive?: boolean;
}

export interface FinancialCategoryFilters {
  type?: TransactionType;
  parentId?: string;
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
  _count?: {
    transactions: number;
  };
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
// FinancialTransaction (Lancamento Financeiro)
// =============================================

export type TransactionStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number; // centavos
  discount?: number | null; // percentual
  interest?: number | null; // percentual
  netAmount: number; // centavos
  paymentCondition: PaymentCondition;
  status: TransactionStatus;
  isRecurring: boolean;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string } | null;
  category: { id: string; name: string; type: TransactionType };
  subcategory?: { id: string; name: string } | null;
  bankAccount?: { id: string; name: string } | null;
  paymentMethodConfig?: { id: string; name: string } | null;
}

export interface CreateFinancialTransactionPayload {
  type: TransactionType;
  description: string;
  amount: number; // centavos
  discount?: number;
  interest?: number;
  paymentCondition: PaymentCondition;
  isRecurring?: boolean;
  dueDate: string;
  notes?: string;
  branchId?: string;
  categoryId: string;
  subcategoryId?: string;
  bankAccountId?: string;
  paymentMethodConfigId?: string;
}

export interface UpdateFinancialTransactionPayload {
  description?: string;
  amount?: number;
  discount?: number;
  interest?: number;
  paymentCondition?: PaymentCondition;
  isRecurring?: boolean;
  dueDate?: string;
  notes?: string;
  branchId?: string;
  categoryId?: string;
  subcategoryId?: string;
  bankAccountId?: string;
  paymentMethodConfigId?: string;
}

export interface FinancialTransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  branchId?: string;
}

export interface PayableTotals {
  overdue: number;
  toPay: number;
  paid: number;
  totalToPay: number;
  taxes: number;
  totalWithTaxes: number;
}

export interface ReceivableTotals {
  notReceived: number;
  toReceive: number;
  received: number;
  totalToReceive: number;
}

export interface BalanceSummary {
  totalRevenue: number;
  totalExpense: number;
  balance: number;
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

export const transactionTypeLabels: Record<TransactionType, string> = {
  EXPENSE: 'Despesa',
  REVENUE: 'Receita',
};

export const transactionTypeColors: Record<TransactionType, string> = {
  EXPENSE: 'bg-red-500/20 text-red-500',
  REVENUE: 'bg-emerald-500/20 text-emerald-500',
};

export const transactionStatusLabels: Record<TransactionStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  CANCELED: 'Cancelado',
};

export const transactionStatusColors: Record<TransactionStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-500',
  PAID: 'bg-emerald-500/20 text-emerald-500',
  OVERDUE: 'bg-red-500/20 text-red-500',
  CANCELED: 'bg-zinc-500/20 text-zinc-400',
};

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
