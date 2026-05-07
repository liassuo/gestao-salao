// Helpers de precificação de serviços/produtos no admin.
// Espelham a lógica do backend (backend/src/common/pricing.helper.ts) para que
// a UI mostre exatamente o preço que o backend vai persistir.
//
// Regras:
// - Plano de assinatura pode ter override de desconto por serviço (subscription_plan_services).
//   Quando o serviço estiver listado no plano, esse % sobrescreve o desconto geral.
// - Override de 100% = "serviço incluso no plano" — zera enquanto houver saldo de
//   `cutsPerMonth` no mês corrente; sem saldo, cai no `discountPercent` global.
// - Entre promoção ativa do item e desconto do plano, prevalece o MAIOR (nunca soma).
// - Produto não tem override por serviço; usa apenas o desconto geral do plano.
import type { ClientSubscription, PlanServiceDiscount, Promotion } from '@/types';

export const UNLIMITED_CUTS = 99;

export interface PlanLike {
  discountPercent?: number | null;
  services?: PlanServiceDiscount[] | null;
  cutsPerMonth?: number | null;
}

/**
 * Estado do saldo da assinatura ATIVA do cliente, no momento da renderização.
 * Casa com `ActiveClientSubscription` do backend (mesmas regras de saldo).
 */
export interface ActiveSubscriptionView {
  plan: PlanLike;
  cutsPerMonth: number;
  cutsUsedThisMonth: number;
  /** Saldo restante; Number.POSITIVE_INFINITY para planos ilimitados (cutsPerMonth=99). */
  remainingCuts: number;
  planLabel: string;
}

export function getActivePlanFromSubscription(
  subscription: ClientSubscription | null | undefined,
): PlanLike | null {
  if (!subscription || subscription.status !== 'ACTIVE') return null;
  return subscription.plan ?? null;
}

export function isUnlimitedCutsPlan(cutsPerMonth: number | null | undefined): boolean {
  return cutsPerMonth === UNLIMITED_CUTS;
}

/**
 * Constrói a visão da assinatura ativa para o frontend admin (plano + saldo
 * mensal). Retorna null para clientes sem assinatura ACTIVE.
 */
export function getActiveSubscriptionView(
  subscription: ClientSubscription | null | undefined,
): ActiveSubscriptionView | null {
  if (!subscription || subscription.status !== 'ACTIVE' || !subscription.plan) return null;
  const plan = subscription.plan as PlanLike;
  const cutsPerMonth = typeof plan.cutsPerMonth === 'number' ? plan.cutsPerMonth : 0;
  const cutsUsedThisMonth =
    typeof subscription.cutsUsedThisMonth === 'number' ? subscription.cutsUsedThisMonth : 0;
  const remainingCuts = isUnlimitedCutsPlan(cutsPerMonth)
    ? Number.POSITIVE_INFINITY
    : Math.max(0, cutsPerMonth - cutsUsedThisMonth);
  const planLabel = subscription.plan.name ? `Plano ${subscription.plan.name}` : 'Assinatura';
  return { plan, cutsPerMonth, cutsUsedThisMonth, remainingCuts, planLabel };
}

/**
 * Indica se o serviço está incluído no plano — convenção: override de 100% em
 * subscription_plan_services. Outros overrides (ex: 30%) são apenas desconto.
 */
export function isPlanIncludedService(
  plan: PlanLike | null | undefined,
  serviceId: string,
): boolean {
  if (!plan) return false;
  const override = (plan.services ?? []).find((s) => s.serviceId === serviceId);
  return !!override && override.discountPercent === 100;
}

export function getPlanGlobalPercent(plan: PlanLike | null | undefined): number {
  const value = plan?.discountPercent;
  return typeof value === 'number' && value > 0 ? value : 0;
}

/**
 * Retorna o desconto do plano para um serviço específico:
 * - se o serviço estiver listado em subscription_plan_services do plano, usa esse %
 *   (mesmo que seja 0 — é um override explícito);
 * - caso contrário, cai para o discountPercent global do plano.
 */
export function getPlanDiscountForService(
  plan: PlanLike | null | undefined,
  serviceId: string,
): number {
  if (!plan) return 0;
  const override = (plan.services ?? []).find((s) => s.serviceId === serviceId);
  if (override && typeof override.discountPercent === 'number' && override.discountPercent >= 0) {
    return override.discountPercent;
  }
  return getPlanGlobalPercent(plan);
}

/**
 * Produtos não têm override por serviço no plano — usa apenas o desconto global.
 */
export function getPlanDiscountForProduct(plan: PlanLike | null | undefined): number {
  return getPlanGlobalPercent(plan);
}

export function getPromoServicePercent(
  serviceId: string,
  promotions: Promotion[] | undefined | null,
): number {
  for (const promo of promotions ?? []) {
    if (promo.services?.some((s) => s.id === serviceId)) {
      return promo.discountPercent;
    }
  }
  return 0;
}

export function getPromoProductPercent(
  productId: string,
  promotions: Promotion[] | undefined | null,
): number {
  for (const promo of promotions ?? []) {
    if (promo.products?.some((p) => p.id === productId)) {
      return promo.discountPercent;
    }
  }
  return 0;
}

export function getPromoServiceMatch(
  serviceId: string,
  promotions: Promotion[] | undefined | null,
): { percent: number; name: string } | null {
  for (const promo of promotions ?? []) {
    if (promo.services?.some((s) => s.id === serviceId)) {
      return { percent: promo.discountPercent, name: promo.name };
    }
  }
  return null;
}

export function getPromoProductMatch(
  productId: string,
  promotions: Promotion[] | undefined | null,
): { percent: number; name: string } | null {
  for (const promo of promotions ?? []) {
    if (promo.products?.some((p) => p.id === productId)) {
      return { percent: promo.discountPercent, name: promo.name };
    }
  }
  return null;
}

export function effectiveDiscountPercent(promoPercent: number, planPercent: number): number {
  return Math.max(promoPercent || 0, planPercent || 0);
}

export function applyDiscount(price: number, percent: number): number {
  if (!percent || percent <= 0) return price;
  return Math.round((price * (100 - percent)) / 100);
}

export interface EffectiveDiscount {
  percent: number;
  name: string;
  source: 'PROMO' | 'PLAN' | 'PLAN_CUT';
}

/** Resultado da resolução de uma unidade de item para o carrinho. */
export interface ResolvedLine {
  unitPrice: number;
  /** Esta unidade consumiu 1 corte do plano (override 100% + saldo disponível). */
  consumesCut: boolean;
  /** Desconto efetivo aplicado, ou null para preço cheio. */
  discount: EffectiveDiscount | null;
  /**
   * True quando o serviço está incluso no plano mas o cliente já consumiu o limite
   * mensal — preview deve avisar "limite mensal atingido, será cobrado".
   */
  planLimitReached: boolean;
}

/**
 * Calcula o desconto final a aplicar em um serviço, considerando promoção ativa
 * e override do plano por serviço (com fallback pro global).
 */
export function resolveServiceDiscount(
  serviceId: string,
  promotions: Promotion[] | undefined | null,
  plan: PlanLike | null | undefined,
  planLabel: string,
): EffectiveDiscount | null {
  const promo = getPromoServiceMatch(serviceId, promotions);
  const planPercent = getPlanDiscountForService(plan, serviceId);
  const promoPercent = promo?.percent ?? 0;
  if (promoPercent <= 0 && planPercent <= 0) return null;
  if (promoPercent >= planPercent) {
    return promo ? { percent: promo.percent, name: promo.name, source: 'PROMO' } : null;
  }
  return { percent: planPercent, name: planLabel, source: 'PLAN' };
}

/**
 * Calcula o desconto final a aplicar em um produto. Para produtos, o plano usa apenas
 * o desconto global (não existe override por produto na tabela subscription_plan_services).
 */
export function resolveProductDiscount(
  productId: string,
  promotions: Promotion[] | undefined | null,
  plan: PlanLike | null | undefined,
  planLabel: string,
): EffectiveDiscount | null {
  const promo = getPromoProductMatch(productId, promotions);
  const planPercent = getPlanDiscountForProduct(plan);
  const promoPercent = promo?.percent ?? 0;
  if (promoPercent <= 0 && planPercent <= 0) return null;
  if (promoPercent >= planPercent) {
    return promo ? { percent: promo.percent, name: promo.name, source: 'PROMO' } : null;
  }
  return { percent: planPercent, name: planLabel, source: 'PLAN' };
}

/**
 * Resolve UMA UNIDADE de item para o carrinho da comanda, considerando saldo de
 * cortes do plano. Espelha exatamente `OrdersService.resolveItemPrice` do backend.
 *
 * @param itemType  'PRODUCT' ou 'SERVICE'
 * @param itemId    productId ou serviceId
 * @param basePrice preço cheio do item (centavos)
 * @param promotions promoções ativas
 * @param sub       visão da assinatura ativa do cliente (com saldo)
 * @param remainingCuts saldo de cortes simulado (decrementa item-a-item no caller)
 */
export function resolveCartLine(
  itemType: 'PRODUCT' | 'SERVICE',
  itemId: string,
  basePrice: number,
  promotions: Promotion[] | undefined | null,
  sub: ActiveSubscriptionView | null,
  remainingCuts: number,
): ResolvedLine {
  const plan = sub?.plan ?? null;
  const planLabel = sub?.planLabel ?? 'Assinatura';

  if (itemType === 'PRODUCT') {
    const discount = resolveProductDiscount(itemId, promotions, plan, planLabel);
    return {
      unitPrice: discount ? applyDiscount(basePrice, discount.percent) : basePrice,
      consumesCut: false,
      discount,
      planLimitReached: false,
    };
  }

  // SERVICE
  const promo = getPromoServiceMatch(itemId, promotions);
  const promoPercent = promo?.percent ?? 0;
  const isIncluded = isPlanIncludedService(plan, itemId);

  // Serviço incluso no plano (override 100%): consome crédito enquanto houver saldo.
  if (isIncluded && plan) {
    if (remainingCuts > 0) {
      return {
        unitPrice: 0,
        consumesCut: true,
        discount: { percent: 100, name: planLabel, source: 'PLAN_CUT' },
        planLimitReached: false,
      };
    }
    // Sem saldo: cai no global do plano (ou cheio se global=0).
    const globalPercent = getPlanGlobalPercent(plan);
    const finalPercent = effectiveDiscountPercent(promoPercent, globalPercent);
    if (finalPercent <= 0) {
      return {
        unitPrice: basePrice,
        consumesCut: false,
        discount: null,
        planLimitReached: true,
      };
    }
    const winner: EffectiveDiscount =
      promoPercent >= globalPercent && promo
        ? { percent: promo.percent, name: promo.name, source: 'PROMO' }
        : { percent: globalPercent, name: planLabel, source: 'PLAN' };
    return {
      unitPrice: applyDiscount(basePrice, winner.percent),
      consumesCut: false,
      discount: winner,
      planLimitReached: true,
    };
  }

  // Serviço fora do plano: aplica regra normal (override por serviço ou global).
  const discount = resolveServiceDiscount(itemId, promotions, plan, planLabel);
  return {
    unitPrice: discount ? applyDiscount(basePrice, discount.percent) : basePrice,
    consumesCut: false,
    discount,
    planLimitReached: false,
  };
}
