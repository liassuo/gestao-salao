import { useState } from 'react';
import { Scale } from 'lucide-react';
import {
  useFinancialTransactions,
  useBalanceSummary,
  useActiveBranches,
} from '@/hooks';
import { BalanceSummaryCards } from '@/components/financial/BalanceSummaryCards';
import { BalanceTable } from '@/components/financial/BalanceTable';
import { SkeletonTable, SkeletonSummaryCards } from '@/components/ui';
import type { FinancialTransactionFilters } from '@/types';

export function Balance() {
  const [filters, setFilters] = useState<FinancialTransactionFilters>({});

  const { data: transactions, isLoading: isLoadingTransactions } = useFinancialTransactions(filters);
  const { data: summary, isLoading: isLoadingSummary } = useBalanceSummary({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchId: filters.branchId,
  });
  const { data: branches } = useActiveBranches();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
          <Scale className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Balanco</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Visao geral das receitas e despesas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="startDate" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            Data Inicial
          </label>
          <input
            type="date"
            id="startDate"
            value={filters.startDate || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value || undefined }))}
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 border-[var(--border-color)]"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="endDate" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            Data Final
          </label>
          <input
            type="date"
            id="endDate"
            value={filters.endDate || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value || undefined }))}
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 border-[var(--border-color)]"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="branchFilter" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            Filial
          </label>
          <select
            id="branchFilter"
            value={filters.branchId || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined }))}
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
        {(filters.startDate || filters.endDate || filters.branchId) && (
          <div className="flex items-end">
            <button
              onClick={() => setFilters({})}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Resumo */}
      {isLoadingSummary ? (
        <SkeletonSummaryCards count={3} />
      ) : (
        <BalanceSummaryCards
          summary={summary || { totalRevenue: 0, totalExpense: 0, balance: 0 }}
          isLoading={false}
        />
      )}

      {/* Tabela */}
      {isLoadingTransactions ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <BalanceTable transactions={transactions || []} />
      )}
    </div>
  );
}
