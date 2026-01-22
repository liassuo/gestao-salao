import { cashRegisterStatusLabels, cashRegisterStatusColors } from '@/types';

interface CashRegisterStatusBadgeProps {
  isOpen: boolean;
}

export function CashRegisterStatusBadge({ isOpen }: CashRegisterStatusBadgeProps) {
  const status = isOpen ? 'open' : 'closed';
  const label = cashRegisterStatusLabels[status];
  const colorClass = cashRegisterStatusColors[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}
