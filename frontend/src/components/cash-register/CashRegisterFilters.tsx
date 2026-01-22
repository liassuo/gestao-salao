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
    <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white p-4 shadow-sm">
      {/* Data Inicial */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="startDate"
          className="mb-1 block text-xs font-medium text-gray-600"
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Data Final */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="endDate"
          className="mb-1 block text-xs font-medium text-gray-600"
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Limpar Filtros */}
      {(filters.startDate || filters.endDate) && (
        <button
          onClick={() => onChange({})}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
