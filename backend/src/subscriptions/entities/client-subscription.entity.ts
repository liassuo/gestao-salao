import { SubscriptionPlan } from './subscription-plan.entity';

/**
 * Entity representing a client's subscription
 */
export class ClientSubscription {
  id: string;
  clientId: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'SUSPENDED';
  startDate: Date;
  endDate: Date | null;
  cutsUsedThisMonth: number;
  lastResetDate: Date;
  /** Quando NOT NULL e status ainda ACTIVE: cliente cancelou mas mantem beneficios ate endDate. */
  canceledAt: Date | null;
  /**
   * Troca de plano agendada. Quando setado, o cron de renovacao no fim do ciclo
   * vai virar planId=pendingPlanId e limpar este campo. Usado em downgrade/lateral
   * para preservar o ciclo ja pago pelo cliente.
   */
  pendingPlanId: string | null;
  createdAt: Date;
  updatedAt: Date;

  client?: {
    id: string;
    name: string;
    phone: string;
  };
  plan?: SubscriptionPlan;
}
