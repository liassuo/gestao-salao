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

/**
 * Estado completo da assinatura ativa do cliente, incluindo o saldo mensal de
 * cortes do plano. Usado pela comanda/agendamento p/ decidir quando consumir um
 * crédito (serviço com override 100% + cortes disponíveis → preço 0 + débito de
 * 1 corte) e quando cair pro fallback (sem cortes → aplica desconto global).
 */
export interface ActiveClientSubscription extends ActiveClientPlan {
  subscriptionId: string;
  cutsPerMonth: number;
  cutsUsedThisMonth: number;
}

/** 99 é a sentinela usada nos planos para "ilimitado". */
export const UNLIMITED_CUTS = 99;

export function isUnlimitedCutsPlan(cutsPerMonth: number): boolean {
  return cutsPerMonth === UNLIMITED_CUTS;
}

/**
 * Calcula quantos cortes ainda restam no ciclo mensal da assinatura.
 * Retorna Number.POSITIVE_INFINITY para planos ilimitados.
 */
export function getRemainingCuts(sub: ActiveClientSubscription | null | undefined): number {
  if (!sub) return 0;
  if (isUnlimitedCutsPlan(sub.cutsPerMonth)) return Number.POSITIVE_INFINITY;
  return Math.max(0, sub.cutsPerMonth - (sub.cutsUsedThisMonth ?? 0));
}

/**
 * Indica se o serviço está "incluído no plano" — convenção: override de 100% em
 * subscription_plan_services. Outros overrides (ex: 30%) são apenas desconto
 * sem consumo de crédito.
 */
export function isPlanIncludedService(
  plan: ActiveClientPlan | null | undefined,
  serviceId: string,
): boolean {
  if (!plan) return false;
  return plan.servicePercents.get(serviceId) === 100;
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
  const sub = await getActiveClientSubscription(supabase, clientId);
  if (!sub) return null;
  return {
    planId: sub.planId,
    globalPercent: sub.globalPercent,
    servicePercents: sub.servicePercents,
  };
}

/**
 * Carrega a assinatura ACTIVE do cliente (uma única — `client_subscriptions` não
 * deveria ter mais de uma linha ACTIVE por cliente). Retorna o plano + saldo mensal
 * de cortes. Use no lugar de `getActiveClientPlan` quando precisar saber quantos
 * cortes ainda restam (ex: comanda decidindo se zera o serviço ou aplica fallback).
 */
export async function getActiveClientSubscription(
  supabase: SupabaseService,
  clientId: string | null | undefined,
): Promise<ActiveClientSubscription | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from('client_subscriptions')
    .select('id, cutsUsedThisMonth, plan:subscription_plans(id, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
    .eq('clientId', clientId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  const row = data as any;
  const plan = row?.plan;
  if (!row?.id || !plan?.id) return null;
  const servicePercents = new Map<string, number>();
  for (const s of (plan.services || []) as { serviceId: string; discountPercent: number }[]) {
    if (typeof s.discountPercent === 'number' && s.discountPercent >= 0) {
      servicePercents.set(s.serviceId, s.discountPercent);
    }
  }
  const globalPercent =
    typeof plan.discountPercent === 'number' && plan.discountPercent > 0 ? plan.discountPercent : 0;
  return {
    subscriptionId: row.id,
    planId: plan.id,
    globalPercent,
    servicePercents,
    cutsPerMonth: typeof plan.cutsPerMonth === 'number' ? plan.cutsPerMonth : 0,
    cutsUsedThisMonth: typeof row.cutsUsedThisMonth === 'number' ? row.cutsUsedThisMonth : 0,
  };
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
