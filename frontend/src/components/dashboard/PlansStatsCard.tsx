import { CreditCard, TrendingUp, TrendingDown } from 'lucide-react';

interface PlansStatsCardProps {
  activePlans: number;
  soldThisMonth: number;
  canceledThisMonth: number;
}

export function PlansStatsCard({ activePlans, soldThisMonth, canceledThisMonth }: PlansStatsCardProps) {
  const items = [
    {
      label: 'Planos Ativos',
      value: activePlans,
      icon: CreditCard,
      color: 'from-blue-600 to-blue-500',
      shadowColor: 'shadow-blue-500/20',
      textColor: 'text-blue-400',
    },
    {
      label: 'Vendidos no Mês',
      value: soldThisMonth,
      icon: TrendingUp,
      color: 'from-green-600 to-green-500',
      shadowColor: 'shadow-green-500/20',
      textColor: 'text-green-400',
    },
    {
      label: 'Cancelados no Mês',
      value: canceledThisMonth,
      icon: TrendingDown,
      color: canceledThisMonth > 0 ? 'from-red-600 to-red-500' : 'from-zinc-600 to-zinc-500',
      shadowColor: canceledThisMonth > 0 ? 'shadow-red-500/20' : 'shadow-zinc-500/20',
      textColor: canceledThisMonth > 0 ? 'text-red-400' : 'text-[var(--text-muted)]',
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Planos / Assinaturas</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} shadow-lg ${item.shadowColor}`}
            >
              <item.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
              <p className={`text-xl font-bold ${item.textColor}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
