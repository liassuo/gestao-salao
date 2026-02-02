import { CreditCard, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui';
import type { PaymentMethodConfig } from '@/types';
import { paymentConditionLabels, paymentMethodScopeLabels } from '@/types';

interface PaymentMethodsTableProps {
  paymentMethods: PaymentMethodConfig[];
  onEdit: (paymentMethod: PaymentMethodConfig) => void;
  onDelete: (paymentMethod: PaymentMethodConfig) => void;
  isLoading?: boolean;
  onNewPaymentMethod?: () => void;
}

export function PaymentMethodsTable({
  paymentMethods,
  onEdit,
  onDelete,
  isLoading,
  onNewPaymentMethod,
}: PaymentMethodsTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (paymentMethods.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhuma forma de pagamento cadastrada"
        description="Cadastre sua primeira forma de pagamento para gerenciar os recebimentos."
        action={onNewPaymentMethod ? { label: 'Nova Forma de Pagamento', onClick: onNewPaymentMethod } : undefined}
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
                Nome
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Escopo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {paymentMethods.map((method) => (
              <tr key={method.id} className="hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-500">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <p className="font-medium text-[var(--text-primary)]">{method.name}</p>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex w-fit rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-500">
                    {paymentConditionLabels[method.type]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex w-fit rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-500">
                    {paymentMethodScopeLabels[method.scope]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {method.isActive ? (
                    <span className="inline-flex w-fit rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-500">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex w-fit rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs font-medium text-zinc-400">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === method.id ? null : method.id)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === method.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-1 shadow-lg">
                          <button
                            onClick={() => {
                              onEdit(method);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(method);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
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
