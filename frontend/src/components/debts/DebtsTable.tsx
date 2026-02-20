import { Banknote, CheckCircle, Receipt, Trash2 } from 'lucide-react';
import { DebtStatusBadge } from './DebtStatusBadge';
import { EmptyState } from '@/components/ui';
import type { Debt } from '@/types';

interface DebtsTableProps {
  debts: Debt[];
  onPay: (debt: Debt) => void;
  onSettle: (debt: Debt) => void;
  onDelete: (debt: Debt) => void;
  isLoading?: boolean;
  onNewDebt?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function DebtsTable({
  debts,
  onPay,
  onSettle,
  onDelete,
  isLoading,
  onNewDebt,
}: DebtsTableProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nenhuma dívida encontrada"
        description="Não há dívidas registradas no momento. Que bom! Ou registre uma nova se necessário."
        action={onNewDebt ? { label: 'Nova Dívida', onClick: onNewDebt } : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Valor Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Pago
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Saldo Restante
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Vencimento
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {debts.map((debt) => (
              <tr key={debt.id} className="hover:bg-[var(--hover-bg)]">
                <td className="whitespace-nowrap px-6 py-4">
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">
                      {debt.client.name}
                    </div>
                    {debt.description && (
                      <div className="text-sm text-[var(--text-muted)]">
                        {debt.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-primary)]">
                  {formatCurrency(debt.amount)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-[#C8923A]">
                  {formatCurrency(debt.amountPaid)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[#A63030]">
                  {formatCurrency(debt.remainingBalance)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <DebtStatusBadge isSettled={debt.isSettled} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-muted)]">
                  {debt.dueDate ? formatDate(debt.dueDate) : '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!debt.isSettled && (
                      <>
                        <button
                          onClick={() => onPay(debt)}
                          disabled={isLoading}
                          className="rounded-lg p-1.5 text-[#C8923A] hover:bg-[#C8923A]/10 disabled:opacity-50"
                          title="Registrar pagamento"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onSettle(debt)}
                          disabled={isLoading}
                          className="rounded-lg p-1.5 text-[#C8923A] hover:bg-[#C8923A]/10 disabled:opacity-50"
                          title="Quitar dívida"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onDelete(debt)}
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
