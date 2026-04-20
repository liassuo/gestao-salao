import { Clock, DollarSign, Tag } from 'lucide-react';
import type { Service, Promotion } from '@/types';

interface AppointmentSummaryProps {
  selectedServices: Service[];
  promotions?: Promotion[];
  planDiscountPercent?: number;
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

function getPromoPercent(serviceId: string, promos: Promotion[]): number {
  for (const promo of promos) {
    if (promo.services?.some((s) => s.id === serviceId)) return promo.discountPercent;
  }
  return 0;
}

export function AppointmentSummary({
  selectedServices,
  promotions = [],
  planDiscountPercent = 0,
  planLabel,
}: AppointmentSummaryProps) {
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || s.duration || 0), 0);

  // Entre promoção e plano, aplica o MAIOR desconto (nunca soma).
  let originalTotal = 0;
  let discountedTotal = 0;
  let usedPlan = false;
  let usedPromo = false;
  for (const s of selectedServices) {
    const promoPct = getPromoPercent(s.id, promotions);
    const pct = Math.max(promoPct, planDiscountPercent);
    originalTotal += s.price;
    discountedTotal += pct > 0 ? Math.round((s.price * (100 - pct)) / 100) : s.price;
    if (pct > 0 && pct === planDiscountPercent && planDiscountPercent >= promoPct) usedPlan = true;
    if (pct > 0 && promoPct > planDiscountPercent) usedPromo = true;
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#C8923A]">
              <Tag className="h-4 w-4" />
              <span>
                {usedPlan && !usedPromo
                  ? `Desconto ${planLabel ?? 'assinatura'} (${planDiscountPercent}%)`
                  : usedPromo && !usedPlan
                  ? 'Desconto promoção'
                  : 'Desconto aplicado'}
              </span>
            </div>
            <span className="text-sm font-medium text-[#8B6914]">
              -{formatCurrency(originalTotal - discountedTotal)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#C8923A]">
            <DollarSign className="h-4 w-4" />
            <span>Valor total</span>
          </div>
          <span className="text-lg font-bold text-[#8B6914]">
            {hasDiscount && (
              <span className="mr-2 text-sm font-normal text-[var(--text-muted)] line-through">
                {formatCurrency(originalTotal)}
              </span>
            )}
            {formatCurrency(discountedTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
