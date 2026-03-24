export type PaymentMethod = 'CASH' | 'PIX' | 'CARD';

export interface Payment {
  id: string;
  amount: number; // centavos
  method: PaymentMethod;
  paidAt: string;
  notes?: string;
  client: {
    id: string;
    name: string;
  };
  appointment?: {
    id: string;
    scheduledAt: string;
  };
  registeredBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  // Asaas
  asaasPaymentId?: string;
  asaasStatus?: string;
  billingType?: string;
  invoiceUrl?: string;
  pixQrCodeBase64?: string;
  pixCopyPaste?: string;
  bankSlipUrl?: string;
}

export interface CreatePaymentPayload {
  clientId: string;
  appointmentId?: string;
  amount: number; // centavos
  method: PaymentMethod;
  registeredBy: string;
  paidAt?: string;
  notes?: string;
}

export interface UpdatePaymentPayload {
  amount?: number;
  method?: PaymentMethod;
  notes?: string;
}

export interface PaymentTotals {
  cash: number;
  pix: number;
  card: number;
  total: number;
}

export interface PaymentFilters {
  clientId?: string;
  startDate?: string;
  endDate?: string;
  method?: PaymentMethod;
}

// Labels para exibição
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão',
};

export const paymentMethodColors: Record<PaymentMethod, string> = {
  CASH: 'bg-zinc-500/20 text-zinc-400',
  PIX: 'bg-blue-500/20 text-blue-500',
  CARD: 'bg-blue-600/20 text-blue-400',
};

// Asaas charge status labels
export const asaasStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Recebido',
  CONFIRMED: 'Confirmado',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  RECEIVED_IN_CASH: 'Recebido em dinheiro',
  REFUND_REQUESTED: 'Estorno solicitado',
  CHARGEBACK_REQUESTED: 'Chargeback',
  DELETED: 'Cancelado',
  CANCELED: 'Cancelado',
};

export const asaasStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  RECEIVED: 'bg-green-500/20 text-green-400',
  CONFIRMED: 'bg-green-500/20 text-green-400',
  OVERDUE: 'bg-red-500/20 text-red-400',
  REFUNDED: 'bg-orange-500/20 text-orange-400',
  DELETED: 'bg-zinc-500/20 text-zinc-400',
  CANCELED: 'bg-zinc-500/20 text-zinc-400',
};
