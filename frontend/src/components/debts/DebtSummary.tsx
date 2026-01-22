import { Receipt, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import type { Debt } from '@/types';

interface DebtSummaryProps {
  debts: Debt[];
  isLoading?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function DebtSummary({ debts, isLoading }: DebtSummaryProps) {
  const totals = debts.reduce(
    (acc, debt) => ({
      total: acc.total + debt.amount,
      paid: acc.paid + debt.amountPaid,
      remaining: acc.remaining + debt.remainingBalance,
      open: acc.open + (debt.isSettled ? 0 : 1),
      settled: acc.settled + (debt.isSettled ? 1 : 0),
    }),
    { total: 0, paid: 0, remaining: 0, open: 0, settled: 0 }
  );

  const cards = [
    {
      label: 'Total em Dívidas',
      value: formatCurrency(totals.total),
      icon: Receipt,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
    },
    {
      label: 'Valor Recebido',
      value: formatCurrency(totals.paid),
      icon: TrendingUp,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'Saldo a Receber',
      value: formatCurrency(totals.remaining),
      icon: TrendingDown,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    {
      label: 'Dívidas Abertas',
      value: String(totals.open),
      subValue: `${totals.settled} quitadas`,
      icon: CheckCircle,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-2 h-8 w-32 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
            >
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-semibold text-gray-900">{card.value}</p>
              {card.subValue && (
                <p className="text-xs text-gray-400">{card.subValue}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
