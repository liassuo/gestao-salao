import { Clock, DollarSign, Tag, AlertTriangle } from 'lucide-react';
import type { Service, Promotion } from '@/types';
import {
  resolveCartLine,
  type ActiveSubscriptionView,
  type ResolvedLine,
} from '@/utils';

interface AppointmentSummaryProps {
  selectedServices: Service[];
  promotions?: Promotion[];
  /**
   * Visão da assinatura ATIVA do cliente (plano + saldo de cortes do mês).
   * Null quando o cliente não tem assinatura ACTIVE — espelha o backend, que
   * só aplica desconto/consumo de cortes para status='ACTIVE'.
   */
  subscription?: ActiveSubscriptionView | null;
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
  subscription,
}: AppointmentSummaryProps) {
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + (s.durationMinutes || s.duration || 0),
    0,
  );

  // Espelha exatamente o cálculo do backend (appointments.service.ts):
  // resolveCartLine consome cortes do plano enquanto houver saldo, e cai pro
  // desconto global quando o saldo zera. Isso evita mostrar R$ 0 na UI quando
  // o backend de fato vai cobrar.
  let originalTotal = 0;
  let discountedTotal = 0;
  let usedPlan = false;
  let usedPromo = false;
  let usedCut = false;
  let limitReached = false;

  let remainingCuts = subscription?.remainingCuts ?? 0;
  const lines: ResolvedLine[] = [];
  for (const s of selectedServices) {
    const line = resolveCartLine('SERVICE', s.id, s.price, promotions, subscription ?? null, remainingCuts);
    lines.push(line);
    if (line.consumesCut) remainingCuts -= 1;
    originalTotal += s.price;
    discountedTotal += line.unitPrice;
    if (line.discount?.source === 'PROMO') usedPromo = true;
    if (line.discount?.source === 'PLAN') usedPlan = true;
    if (line.discount?.source === 'PLAN_CUT') usedCut = true;
    if (line.planLimitReached) limitReached = true;
  }

  const hasDiscount = discountedTotal < originalTotal;

  if (selectedServices.length === 0) {
    return null;
  }

  let discountLabel: string;
  if (usedCut && !usedPromo && !usedPlan) {
    discountLabel = subscription?.planLabel ?? 'Plano';
  } else if (usedPlan && !usedPromo && !usedCut) {
    discountLabel = `Desconto ${subscription?.planLabel ?? 'assinatura'}`;
  } else if (usedPromo && !usedPlan && !usedCut) {
    discountLabel = 'Desconto promoção';
  } else {
    discountLabel = 'Desconto aplicado';
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
          <span className="font-medium text-[#8B6914]">{formatDuration(totalDuration)}</span>
        </div>

        {hasDiscount && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm text-[#C8923A]">
              <Tag className="h-4 w-4 shrink-0" />
              <span className="truncate">{discountLabel}</span>
            </div>
            <span className="shrink-0 text-sm font-medium text-[#8B6914]">
              -{formatCurrency(originalTotal - discountedTotal)}
            </span>
          </div>
        )}

        {limitReached && subscription && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-[#8B6914]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Limite mensal de cortes do plano atingido
              {subscription.cutsPerMonth > 0
                ? ` (${subscription.cutsUsedThisMonth}/${subscription.cutsPerMonth})`
                : ''}
              . Desconto do plano será aplicado em vez do crédito.
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
