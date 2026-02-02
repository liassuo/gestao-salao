import { RefreshCw } from 'lucide-react';
import { useActiveBranches, useProfessionals } from '@/hooks';
import type { CommissionFilters as CommissionFiltersType } from '@/types';

interface CommissionFiltersProps {
  filters: CommissionFiltersType;
  onChange: (filters: CommissionFiltersType) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
}

export function CommissionFilters({ filters, onChange, onGenerate, isGenerating }: CommissionFiltersProps) {
  const { data: branches } = useActiveBranches();
  const { data: professionals } = useProfessionals();

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      {/* Data Inicial */}
      <div className="flex-1 min-w-[180px]">
        <label htmlFor="commStartDate" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Data Inicial
        </label>
        <input
          type="date"
          id="commStartDate"
          value={filters.startDate || ''}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 border-[var(--border-color)]"
        />
      </div>

      {/* Data Final */}
      <div className="flex-1 min-w-[180px]">
        <label htmlFor="commEndDate" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Data Final
        </label>
        <input
          type="date"
          id="commEndDate"
          value={filters.endDate || ''}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 border-[var(--border-color)]"
        />
      </div>

      {/* Profissional */}
      <div className="flex-1 min-w-[200px]">
        <label htmlFor="commProfessional" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Profissional
        </label>
        <select
          id="commProfessional"
          value={filters.professionalId || ''}
          onChange={(e) => onChange({ ...filters, professionalId: e.target.value || undefined })}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 border-[var(--border-color)]"
        >
          <option value="">Todos os profissionais</option>
          {professionals?.map((prof) => (
            <option key={prof.id} value={prof.id}>
              {prof.name}
            </option>
          ))}
        </select>
      </div>

      {/* Filial */}
      <div className="flex-1 min-w-[200px]">
        <label htmlFor="commBranch" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Filial
        </label>
        <select
          id="commBranch"
          value={filters.branchId || ''}
          onChange={(e) => onChange({ ...filters, branchId: e.target.value || undefined })}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 border-[var(--border-color)]"
        >
          <option value="">Todas as filiais</option>
          {branches?.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Botao Gerar Comissoes */}
      <div>
        <button
          onClick={onGenerate}
          disabled={isGenerating || !filters.startDate || !filters.endDate}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
          Gerar Comissoes
        </button>
      </div>

      {/* Limpar Filtros */}
      {(filters.startDate || filters.endDate || filters.professionalId || filters.branchId) && (
        <div>
          <button
            onClick={() => onChange({})}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
