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
  /** Fim do ciclo vigente (ISO/UTC). Null em planos sem data de fim. */
  endDate: string | null;
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
 * Verifica se o CICLO VIGENTE de uma assinatura está pago: existe pelo menos um
 * payment confirmado (paidAt != null) cuja data de pagamento caia dentro do ciclo
 * atual. O piso do ciclo é o mais recente entre startDate e createdAt, com 1 dia de
 * tolerância para fuso (mesma lógica de `syncWithAsaas`). Pagamentos de ciclos
 * anteriores (a mesma linha client_subscriptions é reaproveitada em re-assinaturas)
 * NÃO contam — senão um pagamento antigo manteria o plano "pago" para sempre.
 *
 * Confirmação manual (admin) grava payment com paidAt → também satisfaz o gate.
 */
async function isCurrentCyclePaid(
  supabase: SupabaseService,
  row: { id: string; startDate?: string | null; createdAt?: string | null },
): Promise<boolean> {
  const startMs = row.startDate ? new Date(row.startDate).getTime() : 0;
  const createdMs = row.createdAt ? new Date(row.createdAt).getTime() : 0;
  const cycleStartMs = Math.max(startMs, createdMs);
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const cycleFloorMs = cycleStartMs > 0 ? cycleStartMs - ONE_DAY : 0;

  const { data: payments } = await supabase
    .from('payments')
    .select('paidAt')
    .eq('subscriptionId', row.id)
    .not('paidAt', 'is', null);

  for (const p of (payments || []) as { paidAt: string | null }[]) {
    if (!p.paidAt) continue;
    const paidMs = new Date(p.paidAt).getTime();
    if (Number.isNaN(paidMs)) continue;
    if (paidMs >= cycleFloorMs) return true;
  }
  return false;
}

/**
 * Carrega a assinatura ACTIVE do cliente (uma única — `client_subscriptions` não
 * deveria ter mais de uma linha ACTIVE por cliente). Retorna o plano + saldo mensal
 * de cortes. Use no lugar de `getActiveClientPlan` quando precisar saber quantos
 * cortes ainda restam (ex: comanda decidindo se zera o serviço ou aplica fallback).
 *
 * IMPORTANTE: só retorna não-null se o ciclo vigente estiver PAGO (ver
 * `isCurrentCyclePaid`). Assinatura ACTIVE sem pagamento do ciclo é tratada como
 * não-assinante para fins de crédito/desconto — sem bypass para admin.
 */
export async function getActiveClientSubscription(
  supabase: SupabaseService,
  clientId: string | null | undefined,
): Promise<ActiveClientSubscription | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from('client_subscriptions')
    .select('id, startDate, endDate, createdAt, cutsUsedThisMonth, plan:subscription_plans!planId(id, cutsPerMonth, discountPercent, services:subscription_plan_services(serviceId, discountPercent))')
    .eq('clientId', clientId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  const row = data as any;
  const plan = row?.plan;
  if (!row?.id || !plan?.id) return null;
  // Trata como nao-assinante se o endDate ja venceu mas o status ainda nao foi
  // atualizado (webhook do Asaas atrasado / cron de expiracao ainda nao rodou).
  // Evita aplicar beneficios de plano vencido (desconto e trava de 1 agend./dia).
  // Comparacao por instante (UTC), igual ao resto do fluxo de assinatura.
  if (row.endDate && new Date(row.endDate).getTime() <= Date.now()) return null;

  // GATE DE PAGAMENTO: a assinatura so concede beneficios (credito de corte e
  // desconto) se o CICLO VIGENTE estiver pago. Antes, qualquer linha status=ACTIVE
  // liberava cortes — mesmo que NUNCA tivesse sido paga (legado do bug "nascia
  // ACTIVE de graca") ou que a renovacao do mes nao tivesse caido. Caso reportado:
  // assinante com vencimento "hoje", sem pagamento, marcava e consumia corte de
  // graca; o admin remarcava pelo balcao e o agendamento saia "pelo plano".
  // Regra (espelha syncWithAsaas): considera pago se existe payment confirmado
  // (paidAt != null) cuja data caia DENTRO do ciclo atual — do inicio do ciclo
  // (max entre startDate e createdAt) menos 1 dia de tolerancia (fuso) ate o
  // endDate. Pagamento de um ciclo ja encerrado nao reativa o ciclo novo.
  if (!(await isCurrentCyclePaid(supabase, row))) return null;
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
    endDate: row.endDate ?? null,
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
