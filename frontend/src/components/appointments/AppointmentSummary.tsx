import { Clock, DollarSign, Tag } from 'lucide-react';
import type { Service, Promotion } from '@/types';
import {
  applyDiscount,
  effectiveDiscountPercent,
  getPlanDiscountForService,
  getPromoServicePercent,
  type PlanLike,
} from '@/utils';

interface AppointmentSummaryProps {
  selectedServices: Service[];
  promotions?: Promotion[];
  /**
   * Plano ativo do cliente, com discountPercent global e overrides por serviço.
   * Null/undefined quando não há assinatura ACTIVE — nesse caso não há desconto do plano.
   */
  plan?: PlanLike | null;
  planLabel?: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function AppointmentSummary({
  selectedServices,
  promotions = [],
  plan,
  planLabel,
}: AppointmentSummaryProps) {
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || s.duration || 0), 0);

  // Entre promoção e plano, aplica o MAIOR desconto (nunca soma).
  // Para o plano, considera override por serviço (subscription_plan_services) com fallback no global.
  let originalTotal = 0;
  let discountedTotal = 0;
  let usedPlan = false;
  let usedPromo = false;
  for (const s of selectedServices) {
    const promoPct = getPromoServicePercent(s.id, promotions);
    const planPct = getPlanDiscountForService(plan, s.id);
    const pct = effectiveDiscountPercent(promoPct, planPct);
    originalTotal += s.price;
    discountedTotal += applyDiscount(s.price, pct);
    if (pct > 0 && planPct >= promoPct) usedPlan = true;
    if (pct > 0 && promoPct > planPct) usedPromo = true;
  }
  const hasDiscount = discountedTotal < originalTotal;

  if (selectedServices.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-[#C8923A]/10 p-4">
      <h4 className="mb-3 text-sm font-medium text-[#8B6914]">Resumo</h4>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#C8923A]">
            <Clock className="h-4 w-4" />
            <span>Duração total</span>
          </div>
          <span className="font-medium text-[#8B6914]">
            {formatDuration(totalDuration)}
          </span>
        </div>
        {hasDiscount && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm text-[#C8923A]">
              <Tag className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {usedPlan && !usedPromo
                  ? `Desconto ${planLabel ?? 'assinatura'}`
                  : usedPromo && !usedPlan
                  ? 'Desconto promoção'
                  : 'Desconto aplicado'}
              </span>
            </div>
            <span className="shrink-0 text-sm font-medium text-[#8B6914]">
              -{formatCurrency(originalTotal - discountedTotal)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm text-[#C8923A]">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span>Valor total</span>
          </div>
          <div className="flex shrink-0 flex-col items-end leading-tight">
            {hasDiscount && (
              <span className="text-xs font-normal text-[var(--text-muted)] line-through">
                {formatCurrency(originalTotal)}
              </span>
            )}
            <span className="text-lg font-bold text-[#8B6914]">
              {formatCurrency(discountedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
