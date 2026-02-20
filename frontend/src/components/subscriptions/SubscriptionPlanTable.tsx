import { CreditCard, Scissors, MoreVertical, Edit2, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui';
import type { SubscriptionPlan } from '@/types';

interface SubscriptionPlanTableProps {
  plans: SubscriptionPlan[];
  onEdit: (plan: SubscriptionPlan) => void;
  onDelete: (plan: SubscriptionPlan) => void;
  isLoading?: boolean;
  onNewPlan?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function SubscriptionPlanTable({
  plans,
  onEdit,
  onDelete,
  isLoading,
  onNewPlan,
}: SubscriptionPlanTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhum plano cadastrado"
        description="Cadastre planos de assinatura para seus clientes."
        action={onNewPlan ? { label: 'Novo Plano', onClick: onNewPlan } : undefined}
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
                Plano
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Cortes/Mes
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Preco
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Assinantes
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8923A]/20 text-[#C8923A]">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{plan.name}</p>
                      {plan.description && (
                        <p className="text-sm text-[var(--text-muted)] truncate max-w-[300px]">
                          {plan.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <Scissors className="h-4 w-4" />
                    {plan.cutsPerMonth === 99 ? 'Ilimitado' : `${plan.cutsPerMonth} cortes`}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span className="text-lg font-semibold text-[var(--text-primary)]">
                    {formatCurrency(plan.price)}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">/mes</span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <Users className="h-4 w-4" />
                    {plan._count?.subscriptions || 0}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      plan.isActive
                        ? 'bg-[#C8923A]/20 text-[#C8923A]'
                        : 'bg-zinc-500/20 text-zinc-500'
                    }`}
                  >
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === plan.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-1 shadow-lg">
                          <button
                            onClick={() => {
                              onEdit(plan);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(plan);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#A63030] hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Desativar
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
