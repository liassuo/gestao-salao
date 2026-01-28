import { Banknote, CreditCard, QrCode, Wallet } from 'lucide-react';
import type { PaymentTotals as PaymentTotalsType } from '@/types';

interface PaymentTotalsProps {
  totals: PaymentTotalsType;
  isLoading?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const cards = [
  {
    key: 'cash' as const,
    label: 'Dinheiro',
    icon: Banknote,
    bgColor: 'bg-blue-500/20',
    iconColor: 'text-blue-500',
  },
  {
    key: 'pix' as const,
    label: 'PIX',
    icon: QrCode,
    bgColor: 'bg-blue-500/20',
    iconColor: 'text-blue-500',
  },
  {
    key: 'card' as const,
    label: 'Cartão',
    icon: CreditCard,
    bgColor: 'bg-blue-500/20',
    iconColor: 'text-blue-500',
  },
  {
    key: 'total' as const,
    label: 'Total',
    icon: Wallet,
    bgColor: 'bg-zinc-500/20',
    iconColor: 'text-zinc-400',
  },
];

export function PaymentTotals({ totals, isLoading }: PaymentTotalsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-lg ${card.bgColor}`} />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-16 rounded bg-[var(--hover-bg)]" />
                <div className="h-6 w-24 rounded bg-[var(--hover-bg)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = totals[card.key];
        const isTotal = card.key === 'total';

        return (
          <div
            key={card.key}
            className={`rounded-xl border p-5 ${
              isTotal
                ? 'border-blue-500/30 bg-blue-500/10'
                : 'border-[var(--border-color)] bg-[var(--card-bg)]'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                  isTotal ? 'bg-blue-500/20' : card.bgColor
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${isTotal ? 'text-blue-500' : card.iconColor}`}
                />
              </div>
              <div>
                <p
                  className={`text-sm ${
                    isTotal ? 'text-blue-400' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {card.label}
                </p>
                <p
                  className={`text-xl font-bold ${
                    isTotal ? 'text-blue-500' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {formatCurrency(value)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
