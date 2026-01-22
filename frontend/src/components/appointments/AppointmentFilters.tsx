import { X } from 'lucide-react';
import type { AppointmentFilters, AppointmentStatus, Professional } from '@/types';
import { appointmentStatusLabels } from '@/types';

interface AppointmentFiltersProps {
  filters: AppointmentFilters;
  professionals: Professional[];
  onFilterChange: (filters: AppointmentFilters) => void;
  onClear: () => void;
}

const statusOptions: AppointmentStatus[] = ['SCHEDULED', 'ATTENDED', 'CANCELED', 'NO_SHOW'];

export function AppointmentFiltersComponent({
  filters,
  professionals,
  onFilterChange,
  onClear,
}: AppointmentFiltersProps) {
  const handleChange = (key: keyof AppointmentFilters, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {/* Data Início */}
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Data Início
          </label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Data Fim */}
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Data Fim
          </label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Profissional */}
        <div className="min-w-[180px]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Profissional
          </label>
          <select
            value={filters.professionalId || ''}
            onChange={(e) => handleChange('professionalId', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {appointmentStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        {/* Limpar Filtros */}
        {hasFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
