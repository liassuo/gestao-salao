import {
  TrendingUp,
  Banknote,
  Smartphone,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import type { CashRegisterSummary as CashRegisterSummaryType } from '@/types';

interface CashRegisterSummaryProps {
  summary: CashRegisterSummaryType;
  isLoading?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function CashRegisterSummary({
  summary,
  isLoading,
}: CashRegisterSummaryProps) {
  const cards = [
    {
      label: 'Total Faturado',
      value: formatCurrency(summary.totalRevenue),
      icon: TrendingUp,
      iconBg: 'bg-[#C8923A]/20',
      iconColor: 'text-[#C8923A]',
    },
    {
      label: 'Dinheiro',
      value: formatCurrency(summary.totalCash),
      icon: Banknote,
      iconBg: 'bg-[#C8923A]/20',
      iconColor: 'text-[#C8923A]',
    },
    {
      label: 'PIX',
      value: formatCurrency(summary.totalPix),
      icon: Smartphone,
      iconBg: 'bg-[#C8923A]/20',
      iconColor: 'text-[#C8923A]',
    },
    {
      label: 'Cartão',
      value: formatCurrency(summary.totalCard),
      icon: CreditCard,
      iconBg: 'bg-[#C8923A]/20',
      iconColor: 'text-[#C8923A]',
    },
    {
      label: 'Discrepâncias',
      value: formatCurrency(summary.totalDiscrepancy),
      subValue:
        summary.totalDiscrepancy > 0
          ? 'Sobra'
          : summary.totalDiscrepancy < 0
          ? 'Falta'
          : 'Conferido',
      icon: AlertTriangle,
      iconBg:
        summary.totalDiscrepancy === 0
          ? 'bg-[var(--hover-bg)]'
          : summary.totalDiscrepancy > 0
          ? 'bg-[#C8923A]/20'
          : 'bg-red-500/20',
      iconColor:
        summary.totalDiscrepancy === 0
          ? 'text-[var(--text-muted)]'
          : summary.totalDiscrepancy > 0
          ? 'text-[#C8923A]'
          : 'text-[#A63030]',
      valueColor:
        summary.totalDiscrepancy === 0
          ? 'text-[var(--text-primary)]'
          : summary.totalDiscrepancy > 0
          ? 'text-[#C8923A]'
          : 'text-[#A63030]',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
            <div className="h-4 w-24 rounded bg-[var(--hover-bg)]" />
            <div className="mt-2 h-8 w-32 rounded bg-[var(--hover-bg)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
            >
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
              <p
                className={`text-lg font-semibold ${
                  card.valueColor || 'text-[var(--text-primary)]'
                }`}
              >
                {card.value}
              </p>
              {card.subValue && (
                <p className="text-xs text-[var(--text-muted)]">{card.subValue}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
