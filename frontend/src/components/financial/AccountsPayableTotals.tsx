import { AlertTriangle, Clock, CheckCircle, DollarSign } from 'lucide-react';
import type { PayableTotals } from '@/types';

interface AccountsPayableTotalsProps {
  totals: PayableTotals;
  isLoading: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function AccountsPayableTotals({ totals, isLoading }: AccountsPayableTotalsProps) {
  const cards = [
    {
      label: 'Vencido',
      value: formatCurrency(totals.overdue),
      icon: AlertTriangle,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-500',
    },
    {
      label: 'A Pagar',
      value: formatCurrency(totals.toPay),
      icon: Clock,
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-500',
    },
    {
      label: 'Pago',
      value: formatCurrency(totals.paid),
      icon: CheckCircle,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-500',
    },
    {
      label: 'Total a Pagar',
      value: formatCurrency(totals.totalToPay),
      icon: DollarSign,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
            <div className="h-4 w-24 rounded bg-[var(--hover-bg)]" />
            <div className="mt-2 h-8 w-32 rounded bg-[var(--hover-bg)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
