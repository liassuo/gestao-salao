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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Valor Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Pago
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Saldo Restante
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Vencimento
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {debts.map((debt) => (
              <tr key={debt.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900">
                      {debt.client.name}
                    </div>
                    {debt.description && (
                      <div className="text-sm text-gray-500">
                        {debt.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {formatCurrency(debt.amount)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-green-600">
                  {formatCurrency(debt.amountPaid)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-red-600">
                  {formatCurrency(debt.remainingBalance)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <DebtStatusBadge isSettled={debt.isSettled} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {debt.dueDate ? formatDate(debt.dueDate) : '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!debt.isSettled && (
                      <>
                        <button
                          onClick={() => onPay(debt)}
                          disabled={isLoading}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          title="Registrar pagamento"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onSettle(debt)}
                          disabled={isLoading}
                          className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                          title="Quitar dívida"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onDelete(debt)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
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
