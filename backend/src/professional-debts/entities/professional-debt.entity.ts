/**
 * Professional debt domain entity
 * Representa valor que o profissional deve para a barbearia
 * (ex.: consumiu produto/serviço, recebeu adiantamento).
 *
 * Liquidação:
 * - Padrão: dedução automática na próxima comissão gerada.
 * - Alternativa: pagamento em dinheiro (registra payment no caixa).
 *
 * Nunca causa comissão negativa: se débito > comissão, resíduo
 * permanece como PENDING e é deduzido no ciclo seguinte.
 */
export type ProfessionalDebtStatus =
  | 'PENDING'
  | 'DEDUCTED'
  | 'SETTLED_CASH'
  | 'VOIDED';

export class ProfessionalDebt {
  id: string;
  professionalId: string;

  /** Comanda de origem; nulo para lançamento manual (adiantamento etc.). */
  orderId?: string | null;

  /** Valor total em centavos */
  amount: number;
  amountPaid: number;
  remainingBalance: number;

  description?: string;
  status: ProfessionalDebtStatus;

  /** Comissão na qual foi descontado (quando status = DEDUCTED) */
  deductedFromCommissionId?: string | null;

  settledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
