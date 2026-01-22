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
  CASH: 'bg-green-100 text-green-800',
  PIX: 'bg-purple-100 text-purple-800',
  CARD: 'bg-blue-100 text-blue-800',
};
