export enum UserRole {
  ADMIN = 'ADMIN',
  PROFESSIONAL = 'PROFESSIONAL',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  ATTENDED = 'ATTENDED',
  CANCELED = 'CANCELED',
  NO_SHOW = 'NO_SHOW',
}

export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  CARD = 'CARD',
  BOLETO = 'BOLETO',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}


export enum PaymentCondition {
  A_VISTA = 'A_VISTA',
  A_PRAZO = 'A_PRAZO',
}

export enum PaymentMethodScope {
  COMANDA = 'COMANDA',
  EXPENSE = 'EXPENSE',
  BOTH = 'BOTH',
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

export enum StockMovementType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
}

export enum OrderItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}
