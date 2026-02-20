import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import type { BalanceSummary } from '@/types';

interface BalanceSummaryCardsProps {
  summary: BalanceSummary;
  isLoading: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function BalanceSummaryCards({ summary, isLoading }: BalanceSummaryCardsProps) {
  const isPositive = summary.balance >= 0;

  const cards = [
    {
      label: 'Receitas',
      value: formatCurrency(summary.totalRevenue),
      icon: TrendingUp,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-500',
    },
    {
      label: 'Despesas',
      value: formatCurrency(summary.totalExpense),
      icon: TrendingDown,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-[#A63030]',
    },
    {
      label: 'Saldo',
      value: formatCurrency(summary.balance),
      icon: Scale,
      iconBg: isPositive ? 'bg-[#C8923A]/20' : 'bg-red-500/20',
      iconColor: isPositive ? 'text-[#C8923A]' : 'text-[#A63030]',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
            <div className="h-4 w-24 rounded bg-[var(--hover-bg)]" />
            <div className="mt-2 h-8 w-32 rounded bg-[var(--hover-bg)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
