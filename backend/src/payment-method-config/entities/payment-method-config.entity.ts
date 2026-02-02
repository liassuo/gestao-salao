import { PaymentCondition, PaymentMethodScope } from '@prisma/client';

/**
 * PaymentMethodConfig domain entity
 * Represents the configuration of a payment method available in the system
 * Examples: Dinheiro (A_VISTA/COMANDA), Cartao de Credito (A_PRAZO/BOTH), PIX (A_VISTA/BOTH)
 */
export class PaymentMethodConfig {
  id: string;
  name: string;

  /** A_VISTA or A_PRAZO */
  type: PaymentCondition;

  /** COMANDA, EXPENSE or BOTH */
  scope: PaymentMethodScope;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
