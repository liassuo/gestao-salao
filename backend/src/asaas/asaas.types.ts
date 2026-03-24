// ============================================
// Asaas API Types & Enums
// ============================================

export enum AsaasBillingType {
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
  PIX = 'PIX',
  UNDEFINED = 'UNDEFINED',
}

/** Aceita enum ou string vinda do app (ex.: CREDIT_CARD, CARD). */
export function parseAsaasBillingType(
  value: unknown,
  fallback: AsaasBillingType = AsaasBillingType.PIX,
): AsaasBillingType {
  if (
    value === AsaasBillingType.PIX ||
    value === AsaasBillingType.CREDIT_CARD ||
    value === AsaasBillingType.UNDEFINED
  ) {
    return value;
  }
  if (typeof value === 'string') {
    const u = value.toUpperCase();
    if (u === 'PIX') return AsaasBillingType.PIX;
    if (u === 'CREDIT_CARD' || u === 'CARD') return AsaasBillingType.CREDIT_CARD;
  }
  return fallback;
}

export function asaasBillingToLocalPaymentMethod(bt: AsaasBillingType): string {
  switch (bt) {
    case AsaasBillingType.CREDIT_CARD:
      return 'CARD';
    case AsaasBillingType.BOLETO:
      return 'BOLETO';
    default:
      return 'PIX';
  }
}

export enum AsaasChargeStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  CONFIRMED = 'CONFIRMED',
  OVERDUE = 'OVERDUE',
  REFUNDED = 'REFUNDED',
  RECEIVED_IN_CASH = 'RECEIVED_IN_CASH',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_IN_PROGRESS = 'REFUND_IN_PROGRESS',
  CHARGEBACK_REQUESTED = 'CHARGEBACK_REQUESTED',
  CHARGEBACK_DISPUTE = 'CHARGEBACK_DISPUTE',
  AWAITING_CHARGEBACK_REVERSAL = 'AWAITING_CHARGEBACK_REVERSAL',
  DUNNING_REQUESTED = 'DUNNING_REQUESTED',
  DUNNING_RECEIVED = 'DUNNING_RECEIVED',
  AWAITING_RISK_ANALYSIS = 'AWAITING_RISK_ANALYSIS',
}

export enum AsaasSubscriptionCycle {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  BIMONTHLY = 'BIMONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUALLY = 'SEMIANNUALLY',
  YEARLY = 'YEARLY',
}

export enum AsaasWebhookEvent {
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_AWAITING_RISK_ANALYSIS = 'PAYMENT_AWAITING_RISK_ANALYSIS',
  PAYMENT_APPROVED_BY_RISK_ANALYSIS = 'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  PAYMENT_REPROVED_BY_RISK_ANALYSIS = 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  PAYMENT_UPDATED = 'PAYMENT_UPDATED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_ANTICIPATED = 'PAYMENT_ANTICIPATED',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  PAYMENT_DELETED = 'PAYMENT_DELETED',
  PAYMENT_RESTORED = 'PAYMENT_RESTORED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  PAYMENT_REFUND_IN_PROGRESS = 'PAYMENT_REFUND_IN_PROGRESS',
  PAYMENT_CHARGEBACK_REQUESTED = 'PAYMENT_CHARGEBACK_REQUESTED',
  PAYMENT_CHARGEBACK_DISPUTE = 'PAYMENT_CHARGEBACK_DISPUTE',
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL = 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  PAYMENT_DUNNING_RECEIVED = 'PAYMENT_DUNNING_RECEIVED',
  PAYMENT_DUNNING_REQUESTED = 'PAYMENT_DUNNING_REQUESTED',
  PAYMENT_BANK_SLIP_VIEWED = 'PAYMENT_BANK_SLIP_VIEWED',
  PAYMENT_CHECKOUT_VIEWED = 'PAYMENT_CHECKOUT_VIEWED',
}

// ============================================
// API Response Interfaces
// ============================================

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
}

export interface AsaasCreateCustomerPayload {
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasCharge {
  id: string;
  customer: string;
  dateCreated: string;
  dueDate: string;
  value: number;
  netValue?: number;
  billingType: AsaasBillingType;
  status: AsaasChargeStatus;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  discount?: {
    value: number;
    dueDateLimitDays: number;
    type: string;
  };
  fine?: {
    value: number;
    type: string;
  };
  interest?: {
    value: number;
    type: string;
  };
}

export interface AsaasCreateChargePayload {
  customer: string; // Asaas customer ID
  billingType: AsaasBillingType;
  value: number; // Valor em reais (ex: 50.00)
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  creditCard?: AsaasCreditCard;
  creditCardHolderInfo?: AsaasCreditCardHolderInfo;
  remoteIp?: string;
}

export interface AsaasPixQrCode {
  encodedImage: string; // Base64
  payload: string; // Copia e cola
  expirationDate: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: AsaasSubscriptionCycle;
  description?: string;
  status: string;
  externalReference?: string;
}

export interface AsaasCreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string | null;
  phone: string;
  mobilePhone?: string;
}

export interface AsaasCreateSubscriptionPayload {
  customer: string; // Asaas customer ID
  billingType: AsaasBillingType;
  value: number; // Valor em reais
  nextDueDate: string; // YYYY-MM-DD
  cycle: AsaasSubscriptionCycle;
  description?: string;
  externalReference?: string;
  creditCard?: AsaasCreditCard;
  creditCardHolderInfo?: AsaasCreditCardHolderInfo;
  remoteIp?: string;
}

export interface AsaasWebhookPayload {
  event: AsaasWebhookEvent;
  payment?: AsaasCharge;
}

export interface AsaasApiError {
  errors: Array<{
    code: string;
    description: string;
  }>;
}
