export class PayOrderDto {
  paymentMethod?: 'CASH' | 'PIX' | 'CARD';
  registeredBy?: string;
}
