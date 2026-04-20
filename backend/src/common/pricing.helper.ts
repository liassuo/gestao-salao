import { SupabaseService } from '../supabase/supabase.service';

export interface PromotionMatch {
  discountPercent: number;
  products?: { id: string }[] | null;
  services?: { id: string }[] | null;
  promotion_services?: { serviceId: string }[] | null;
  promotion_products?: { productId: string }[] | null;
}

export async function getClientPlanDiscount(
  supabase: SupabaseService,
  clientId: string | null | undefined,
): Promise<number> {
  if (!clientId) return 0;
  const { data } = await supabase
    .from('client_subscriptions')
    .select('plan:subscription_plans(discountPercent)')
    .eq('clientId', clientId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  const percent = (data as any)?.plan?.discountPercent;
  return typeof percent === 'number' && percent > 0 ? percent : 0;
}

export async function getActivePromotions(
  supabase: SupabaseService,
): Promise<PromotionMatch[]> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('promotions')
    .select('discountPercent, promotion_services(serviceId), promotion_products(productId)')
    .eq('isActive', true)
    .eq('status', 'ACTIVE')
    .lte('startDate', now)
    .gte('endDate', now);
  return (data as PromotionMatch[]) || [];
}

export function getPromoDiscountForService(
  promos: PromotionMatch[],
  serviceId: string,
): number {
  for (const promo of promos) {
    const links = (promo.promotion_services as any[]) || [];
    if (links.some((l) => l.serviceId === serviceId)) return promo.discountPercent;
  }
  return 0;
}

export function getPromoDiscountForProduct(
  promos: PromotionMatch[],
  productId: string,
): number {
  for (const promo of promos) {
    const links = (promo.promotion_products as any[]) || [];
    if (links.some((l) => l.productId === productId)) return promo.discountPercent;
  }
  return 0;
}

export function effectiveDiscountPercent(
  promoPercent: number,
  planPercent: number,
): number {
  return Math.max(promoPercent || 0, planPercent || 0);
}

export function applyDiscount(price: number, percent: number): number {
  if (!percent || percent <= 0) return price;
  return Math.round((price * (100 - percent)) / 100);
}
