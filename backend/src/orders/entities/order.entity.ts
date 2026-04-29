export type OrderConsumerType = 'CLIENT' | 'PROFESSIONAL';

/**
 * Status semânticos:
 *  - PENDING       : aberta
 *  - PAID          : paga em dinheiro/Asaas (entrada no caixa)
 *  - PAID_AS_DEBT  : lançada como débito do profissional (sem entrada no caixa,
 *                    sem comissão, débito vira saldo a deduzir na próxima comissão)
 *  - CANCELED      : cancelada (estoque/débito revertidos quando aplicável)
 */
export type OrderStatus = 'PENDING' | 'PAID' | 'PAID_AS_DEBT' | 'CANCELED';

export class Order {
  id: string;
  status: OrderStatus | string;
  totalAmount: number;
  notes?: string;
  clientId?: string;
  professionalId?: string;
  branchId?: string;
  paymentId?: string;
  appointmentId?: string;

  /** Quem está consumindo a comanda. Default: CLIENT. */
  consumerType: OrderConsumerType;

  /** Profissional consumidor quando consumerType = PROFESSIONAL. */
  consumerProfessionalId?: string;

  createdAt: Date;
  updatedAt: Date;
}
