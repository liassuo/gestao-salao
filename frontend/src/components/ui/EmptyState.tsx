import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--hover-bg)]">
        <Icon className="h-8 w-8 text-[var(--text-muted)]" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
