/**
 * Entity representing a subscription plan
 */
export class SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cutsPerMonth: number;
  discountPercent: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
