import { debtStatusLabels, debtStatusColors } from '@/types';

interface DebtStatusBadgeProps {
  isSettled: boolean;
}

export function DebtStatusBadge({ isSettled }: DebtStatusBadgeProps) {
  const status = isSettled ? 'settled' : 'open';
  const label = debtStatusLabels[status];
  const colorClass = debtStatusColors[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}
