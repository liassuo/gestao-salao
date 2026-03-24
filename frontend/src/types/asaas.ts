// ============================================
// Asaas Types (Frontend)
// ============================================

export const AsaasBillingType = {
  CREDIT_CARD: 'CREDIT_CARD',
  PIX: 'PIX',
  UNDEFINED: 'UNDEFINED',
} as const;

export type AsaasBillingType = (typeof AsaasBillingType)[keyof typeof AsaasBillingType];

export type AsaasChargeStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS'
  | 'DELETED'
  | 'CANCELED';

export interface AsaasCharge {
  id: string;
  customer: string;
  dateCreated: string;
  dueDate: string;
  value: number;
  netValue?: number;
  /** Resposta Asaas pode incluir valores legados (ex.: BOLETO) */
  billingType: string;
  status: AsaasChargeStatus;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
}

export interface AsaasPixQrCode {
  encodedImage: string; // Base64
  payload: string; // Copia e cola
  expirationDate: string;
}

export interface CreateChargePayload {
  clientId: string;
  billingType: AsaasBillingType;
  value: number; // centavos
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  appointmentId?: string;
  orderId?: string;
}

export interface AsaasChargeResponse {
  payment: any;
  asaasCharge: AsaasCharge;
  pixQrCode?: AsaasPixQrCode | null;
}
