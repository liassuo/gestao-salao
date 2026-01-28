import type { CashRegisterFilters as CashRegisterFiltersType } from '@/types';

interface CashRegisterFiltersProps {
  filters: CashRegisterFiltersType;
  onChange: (filters: CashRegisterFiltersType) => void;
}

export function CashRegisterFilters({
  filters,
  onChange,
}: CashRegisterFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      {/* Data Inicial */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="startDate"
          className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
        >
          Data Inicial
        </label>
        <input
          type="date"
          id="startDate"
          value={filters.startDate || ''}
          onChange={(e) =>
            onChange({ ...filters, startDate: e.target.value || undefined })
          }
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Data Final */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="endDate"
          className="mb-1 block text-xs font-medium text-[var(--text-muted)]"
        >
          Data Final
        </label>
        <input
          type="date"
          id="endDate"
          value={filters.endDate || ''}
          onChange={(e) =>
            onChange({ ...filters, endDate: e.target.value || undefined })
          }
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Limpar Filtros */}
      {(filters.startDate || filters.endDate) && (
        <button
          onClick={() => onChange({})}
          className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
