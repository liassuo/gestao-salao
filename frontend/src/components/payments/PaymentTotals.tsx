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
    bgColor: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    key: 'pix' as const,
    label: 'PIX',
    icon: QrCode,
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    key: 'card' as const,
    label: 'Cartão',
    icon: CreditCard,
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    key: 'total' as const,
    label: 'Total',
    icon: Wallet,
    bgColor: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
];

export function PaymentTotals({ totals, isLoading }: PaymentTotalsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="animate-pulse rounded-xl bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-lg ${card.bgColor}`} />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-6 w-24 rounded bg-gray-200" />
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
            className={`rounded-xl p-5 shadow-sm ${
              isTotal ? 'bg-gray-900 text-white' : 'bg-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                  isTotal ? 'bg-white/10' : card.bgColor
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${isTotal ? 'text-white' : card.iconColor}`}
                />
              </div>
              <div>
                <p
                  className={`text-sm ${
                    isTotal ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {card.label}
                </p>
                <p
                  className={`text-xl font-bold ${
                    isTotal ? 'text-white' : 'text-gray-800'
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
