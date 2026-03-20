import { Users, Scissors, MoreVertical, XCircle, Phone, RefreshCw } from 'lucide-react';
import { useState, useRef } from 'react';
import { EmptyState } from '@/components/ui';
import { formatPhone } from '@/utils/format';
import type { ClientSubscription } from '@/types';
import { subscriptionStatusLabels, subscriptionStatusColors } from '@/types';

interface ClientSubscriptionTableProps {
  subscriptions: ClientSubscription[];
  onCancel: (subscription: ClientSubscription) => void;
  onUseCut: (subscription: ClientSubscription) => void;
  onResetCuts: (subscription: ClientSubscription) => void;
  isLoading?: boolean;
  onNewSubscription?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function ClientSubscriptionTable({
  subscriptions,
  onCancel,
  onUseCut,
  onResetCuts,
  isLoading,
  onNewSubscription,
}: ClientSubscriptionTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (subscriptions.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma assinatura encontrada"
        description="Assine clientes em planos para gerenciar suas assinaturas."
        action={onNewSubscription ? { label: 'Nova Assinatura', onClick: onNewSubscription } : undefined}
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
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Plano
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Cortes Usados
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Inicio
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
            {subscriptions.map((subscription) => {
              const plan = subscription.plan;
              const cutsPerMonth = plan?.cutsPerMonth ?? 0;
              const cutsPercentage = cutsPerMonth === 99
                ? 0
                : cutsPerMonth > 0 ? (subscription.cutsUsedThisMonth / cutsPerMonth) * 100 : 0;

              return (
                <tr key={subscription.id} className="hover:bg-[var(--hover-bg)]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8923A]/20 text-[#C8923A]">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">
                          {subscription.client?.name || 'Cliente'}
                        </p>
                        <p className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
                          <Phone className="h-3 w-3" />
                          {formatPhone(subscription.client?.phone) || '-'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {plan?.name || 'Plano'}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {formatCurrency(plan?.price ?? 0)}/mes
                      </p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-[var(--text-muted)]" />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {subscription.cutsUsedThisMonth} / {cutsPerMonth === 99 ? '∞' : cutsPerMonth}
                        </p>
                        {cutsPerMonth !== 99 && (
                          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-[var(--hover-bg)]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                cutsPercentage >= 100 ? 'bg-red-500' : 'bg-[#C8923A]'
                              }`}
                              style={{ width: `${Math.min(cutsPercentage, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {formatDate(subscription.startDate)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        subscriptionStatusColors[subscription.status]
                      }`}
                    >
                      {subscriptionStatusLabels[subscription.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    {subscription.status === 'ACTIVE' && (
                      <div className="relative inline-block">
                        <button
                          ref={(el) => { menuBtnRefs.current[subscription.id] = el; }}
                          onClick={() => {
                            if (openMenuId === subscription.id) {
                              setOpenMenuId(null);
                            } else {
                              const btn = menuBtnRefs.current[subscription.id];
                              if (btn) {
                                const rect = btn.getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, left: rect.right - 160 });
                              }
                              setOpenMenuId(subscription.id);
                            }
                          }}
                          disabled={isLoading}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>

                        {openMenuId === subscription.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div
                              className="fixed z-20 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-1 shadow-lg"
                              style={{ top: menuPos.top, left: menuPos.left }}
                            >
                              <button
                                onClick={() => {
                                  onUseCut(subscription);
                                  setOpenMenuId(null);
                                }}
                                disabled={cutsPerMonth !== 99 && subscription.cutsUsedThisMonth >= cutsPerMonth}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Scissors className="h-4 w-4 text-[#C8923A]" />
                                Registrar Corte
                              </button>
                              <button
                                onClick={() => {
                                  onResetCuts(subscription);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                              >
                                <RefreshCw className="h-4 w-4 text-green-500" />
                                Renovar Cortes
                              </button>
                              <div className="my-1 border-t border-[var(--border-color)]" />
                              <button
                                onClick={() => {
                                  onCancel(subscription);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#A63030] hover:bg-red-500/10"
                              >
                                <XCircle className="h-4 w-4" />
                                Cancelar Assinatura
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
