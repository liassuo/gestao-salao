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
  createdAt: Date;
  updatedAt: Date;

  client?: {
    id: string;
    name: string;
    phone: string;
  };
  plan?: SubscriptionPlan;
}
