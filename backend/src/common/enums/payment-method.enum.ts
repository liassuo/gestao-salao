/**
 * Payment methods accepted by the barbershop
 * CASH: Physical cash payment
 * PIX: Brazilian instant payment system
 * CARD: Credit or debit card payment
 *
 * NOTE: These are for REGISTRATION ONLY.
 * The system does NOT process payments or integrate with payment gateways.
 */
export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  CARD = 'CARD',
}
