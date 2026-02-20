import { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import {
  useFinancialTransactions,
  usePayableTotals,
  useMarkTransactionAsPaid,
  useDeleteFinancialTransaction,
  useActiveBranches,
  getApiErrorMessage,
} from '@/hooks';
import { AccountsPayableTotals } from '@/components/financial/AccountsPayableTotals';
import { AccountsPayableTable } from '@/components/financial/AccountsPayableTable';
import { SkeletonTable, SkeletonSummaryCards, ConfirmModal, useToast } from '@/components/ui';
import type { FinancialTransaction, FinancialTransactionFilters } from '@/types';

export function AccountsPayable() {
  const [filters, setFilters] = useState<FinancialTransactionFilters>({
    type: 'EXPENSE',
  });
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);

  const { data: transactions, isLoading: isLoadingTransactions } = useFinancialTransactions(filters);
  const { data: totals, isLoading: isLoadingTotals } = usePayableTotals({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchId: filters.branchId,
  });
  const { data: branches } = useActiveBranches();
  const markAsPaid = useMarkTransactionAsPaid();
  const deleteTransaction = useDeleteFinancialTransaction();
  const toast = useToast();

  const handleMarkAsPaid = async () => {
    if (!payingTransaction) return;
    try {
      await markAsPaid.mutateAsync(payingTransaction.id);
      setPayingTransaction(null);
      toast.success('Pagamento registrado', 'A despesa foi marcada como paga.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    try {
      await deleteTransaction.mutateAsync(deletingTransaction.id);
      setDeletingTransaction(null);
      toast.success('Despesa excluida', 'A despesa foi excluida com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
          <TrendingDown className="h-5 w-5 text-[#A63030]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contas a Pagar</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Gerencie as despesas e contas a pagar
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
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
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
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
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
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
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
              onClick={() => setFilters({ type: 'EXPENSE' })}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Totais */}
      {isLoadingTotals ? (
        <SkeletonSummaryCards count={4} />
      ) : (
        <AccountsPayableTotals
          totals={totals || { overdue: 0, toPay: 0, paid: 0, totalToPay: 0, taxes: 0, totalWithTaxes: 0 }}
          isLoading={false}
        />
      )}

      {/* Tabela */}
      {isLoadingTransactions ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <AccountsPayableTable
          transactions={transactions || []}
          onMarkAsPaid={setPayingTransaction}
          onDelete={setDeletingTransaction}
          isLoading={markAsPaid.isPending || deleteTransaction.isPending}
        />
      )}

      {/* Modal Confirmar Pagamento */}
      <ConfirmModal
        isOpen={!!payingTransaction}
        onClose={() => setPayingTransaction(null)}
        onConfirm={handleMarkAsPaid}
        title="Confirmar Pagamento"
        message={`Deseja marcar a despesa "${payingTransaction?.description}" como paga?`}
        confirmLabel="Pagar"
        variant="info"
        isLoading={markAsPaid.isPending}
      />

      {/* Modal Confirmar Exclusao */}
      <ConfirmModal
        isOpen={!!deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        onConfirm={handleDelete}
        title="Excluir Despesa"
        message={`Tem certeza que deseja excluir a despesa "${deletingTransaction?.description}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteTransaction.isPending}
      />
    </div>
  );
}
