import { TrendingDown, CheckCircle, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { FinancialTransaction } from '@/types';
import { transactionStatusLabels, transactionStatusColors } from '@/types';

interface AccountsPayableTableProps {
  transactions: FinancialTransaction[];
  onMarkAsPaid: (transaction: FinancialTransaction) => void;
  onDelete: (transaction: FinancialTransaction) => void;
  isLoading?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function AccountsPayableTable({ transactions, onMarkAsPaid, onDelete, isLoading }: AccountsPayableTableProps) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={TrendingDown}
        title="Nenhuma despesa encontrada"
        description="Nao ha contas a pagar registradas para o periodo selecionado."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Descricao
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Categoria
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Vencimento
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-[var(--hover-bg)]">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium text-[var(--text-primary)]">
                    {transaction.description}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                  {transaction.category?.name || 'Sem categoria'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                  {formatCurrency(transaction.netAmount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                  {formatDate(transaction.dueDate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${transactionStatusColors[transaction.status]}`}>
                    {transactionStatusLabels[transaction.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {transaction.status !== 'PAID' && transaction.status !== 'CANCELED' && (
                      <button
                        onClick={() => onMarkAsPaid(transaction)}
                        disabled={isLoading}
                        className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
                        title="Marcar como pago"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(transaction)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[#A63030] hover:bg-red-500/10 disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
