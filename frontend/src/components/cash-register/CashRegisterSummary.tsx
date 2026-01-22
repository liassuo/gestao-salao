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
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Dinheiro',
      value: formatCurrency(summary.totalCash),
      icon: Banknote,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'PIX',
      value: formatCurrency(summary.totalPix),
      icon: Smartphone,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Cartão',
      value: formatCurrency(summary.totalCard),
      icon: CreditCard,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
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
          ? 'bg-gray-100'
          : summary.totalDiscrepancy > 0
          ? 'bg-green-100'
          : 'bg-red-100',
      iconColor:
        summary.totalDiscrepancy === 0
          ? 'text-gray-600'
          : summary.totalDiscrepancy > 0
          ? 'text-green-600'
          : 'text-red-600',
      valueColor:
        summary.totalDiscrepancy === 0
          ? 'text-gray-900'
          : summary.totalDiscrepancy > 0
          ? 'text-green-600'
          : 'text-red-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-2 h-8 w-32 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <p
                className={`text-lg font-semibold ${
                  card.valueColor || 'text-gray-900'
                }`}
              >
                {card.value}
              </p>
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
