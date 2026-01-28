export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'SUSPENDED';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number; // centavos
  cutsPerMonth: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    subscriptions: number;
  };
}

export interface ClientSubscription {
  id: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
  cutsUsedThisMonth: number;
  lastResetDate: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    cutsPerMonth: number;
  };
}

export interface CreatePlanPayload {
  name: string;
  description?: string;
  price: number; // centavos
  cutsPerMonth: number;
}

export interface UpdatePlanPayload {
  name?: string;
  description?: string;
  price?: number;
  cutsPerMonth?: number;
  isActive?: boolean;
}

export interface SubscribeClientPayload {
  clientId: string;
  planId: string;
}

export interface RemainingCuts {
  cutsUsed: number;
  cutsPerMonth: number;
  remaining: number;
  needsReset: boolean;
}

// Labels para exibicao
export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Ativa',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
  SUSPENDED: 'Suspensa',
};

export const subscriptionStatusColors: Record<SubscriptionStatus, string> = {
  ACTIVE: 'bg-blue-500/20 text-blue-500',
  CANCELED: 'bg-red-500/20 text-red-500',
  EXPIRED: 'bg-red-500/20 text-red-500',
  SUSPENDED: 'bg-zinc-500/20 text-zinc-500',
};
