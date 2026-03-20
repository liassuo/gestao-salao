import {
  TrendingUp,
  Banknote,
  Smartphone,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
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
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
            <div className="h-4 w-24 rounded bg-[var(--hover-bg)]" />
            <div className="mt-2 h-8 w-32 rounded bg-[var(--hover-bg)]" />
          </div>
        ))}
      </div>
    );
  }

  const discrepancyIsZero = summary.totalDiscrepancy === 0;
  const discrepancyPositive = summary.totalDiscrepancy > 0;

  const cards = [
    {
      label: 'Total Faturado',
      value: formatCurrency(summary.totalRevenue),
      subValue: `${summary.count} ${summary.count === 1 ? 'dia' : 'dias'}`,
      icon: TrendingUp,
      iconBg: 'bg-[#C8923A]/15',
      iconColor: 'text-[#C8923A]',
      valueColor: 'text-[var(--text-primary)]',
    },
    {
      label: 'Dinheiro',
      value: formatCurrency(summary.totalCash),
      icon: Banknote,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      valueColor: 'text-[var(--text-primary)]',
    },
    {
      label: 'PIX',
      value: formatCurrency(summary.totalPix),
      icon: Smartphone,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      valueColor: 'text-[var(--text-primary)]',
    },
    {
      label: 'Cartão',
      value: formatCurrency(summary.totalCard),
      icon: CreditCard,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      valueColor: 'text-[var(--text-primary)]',
    },
    {
      label: 'Discrepancias',
      value: formatCurrency(summary.totalDiscrepancy),
      subValue: discrepancyIsZero
        ? 'Tudo conferido'
        : discrepancyPositive
        ? 'Sobra total'
        : 'Falta total',
      icon: discrepancyIsZero ? CheckCircle2 : AlertTriangle,
      iconBg: discrepancyIsZero
        ? 'bg-green-500/10'
        : discrepancyPositive
        ? 'bg-amber-500/10'
        : 'bg-red-500/10',
      iconColor: discrepancyIsZero
        ? 'text-green-500'
        : discrepancyPositive
        ? 'text-amber-500'
        : 'text-[#A63030]',
      valueColor: discrepancyIsZero
        ? 'text-green-500'
        : discrepancyPositive
        ? 'text-amber-500'
        : 'text-[#A63030]',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
            >
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
              <p className={`text-lg font-bold ${card.valueColor}`}>
                {card.value}
              </p>
              {card.subValue && (
                <p className="text-[10px] text-[var(--text-muted)]">{card.subValue}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
