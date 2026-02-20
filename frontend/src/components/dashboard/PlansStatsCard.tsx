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
      color: 'from-[#8B6914] to-[#C8923A]',
      shadowColor: 'shadow-[#C8923A]/20',
      textColor: 'text-[#D4A85C]',
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
      color: canceledThisMonth > 0 ? 'from-[#8B2020] to-[#A63030]' : 'from-[#5C4530] to-[#6B5540]',
      shadowColor: canceledThisMonth > 0 ? 'shadow-[#8B2020]/20' : 'shadow-zinc-500/20',
      textColor: canceledThisMonth > 0 ? 'text-[#C45050]' : 'text-[var(--text-muted)]',
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
