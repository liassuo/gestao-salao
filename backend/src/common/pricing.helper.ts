import { SupabaseService } from '../supabase/supabase.service';

export interface PromotionMatch {
  discountPercent: number;
  products?: { id: string }[] | null;
  services?: { id: string }[] | null;
  promotion_services?: { serviceId: string }[] | null;
  promotion_products?: { productId: string }[] | null;
}

/**
 * Resumo do plano ativo de um cliente para cálculo de descontos.
 * - planId: usado para lookup per-service
 * - globalPercent: discountPercent do plano (fallback p/ produtos e serviços não-listados)
 * - servicePercents: mapa serviceId -> percent (override por serviço)
 */
export interface ActiveClientPlan {
  planId: string;
  globalPercent: number;
  servicePercents: Map<string, number>;
}

export async function getClientPlanDiscount(
  supabase: SupabaseService,
  clientId: string | null | undefined,
): Promise<number> {
  const plan = await getActiveClientPlan(supabase, clientId);
  return plan?.globalPercent ?? 0;
}

export async function getActiveClientPlan(
  supabase: SupabaseService,
  clientId: string | null | undefined,
): Promise<ActiveClientPlan | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from('client_subscriptions')
    .select('plan:subscription_plans(id, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
    .eq('clientId', clientId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  const plan = (data as any)?.plan;
  if (!plan?.id) return null;
  const servicePercents = new Map<string, number>();
  for (const s of (plan.services || []) as { serviceId: string; discountPercent: number }[]) {
    if (typeof s.discountPercent === 'number' && s.discountPercent >= 0) {
      servicePercents.set(s.serviceId, s.discountPercent);
    }
  }
  const globalPercent =
    typeof plan.discountPercent === 'number' && plan.discountPercent > 0 ? plan.discountPercent : 0;
  return { planId: plan.id, globalPercent, servicePercents };
}

/**
 * Retorna o desconto do plano para um serviço específico:
 * - se serviço estiver listado em subscription_plan_services do plano ativo, usa esse %
 * - caso contrário, usa o discountPercent global do plano
 */
export function getPlanDiscountForService(
  plan: ActiveClientPlan | null,
  serviceId: string,
): number {
  if (!plan) return 0;
  const override = plan.servicePercents.get(serviceId);
  if (typeof override === 'number') return override;
  return plan.globalPercent;
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
