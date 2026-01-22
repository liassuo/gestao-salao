import { useClients } from '@/hooks';
import type { DebtFilters as DebtFiltersType } from '@/types';

interface DebtFiltersProps {
  filters: DebtFiltersType;
  onChange: (filters: DebtFiltersType) => void;
}

export function DebtFilters({ filters, onChange }: DebtFiltersProps) {
  const { data: clients, isLoading: isLoadingClients } = useClients();

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
      {/* Cliente */}
      <div className="flex-1 min-w-[200px]">
        <label
          htmlFor="filterClient"
          className="mb-1 block text-xs font-medium text-gray-600"
        >
          Cliente
        </label>
        <select
          id="filterClient"
          value={filters.clientId || ''}
          onChange={(e) =>
            onChange({ ...filters, clientId: e.target.value || undefined })
          }
          disabled={isLoadingClients}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        >
          <option value="">Todos os clientes</option>
          {clients?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="filterStatus"
          className="mb-1 block text-xs font-medium text-gray-600"
        >
          Status
        </label>
        <select
          id="filterStatus"
          value={filters.isSettled === undefined ? '' : String(filters.isSettled)}
          onChange={(e) => {
            const value = e.target.value;
            onChange({
              ...filters,
              isSettled: value === '' ? undefined : value === 'true',
            });
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        >
          <option value="">Todos</option>
          <option value="false">Abertas</option>
          <option value="true">Quitadas</option>
        </select>
      </div>

      {/* Limpar Filtros */}
      {(filters.clientId || filters.isSettled !== undefined) && (
        <div className="flex items-end">
          <button
            onClick={() => onChange({})}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
