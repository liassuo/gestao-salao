import { Users, Scissors, MoreVertical, XCircle, Phone, RefreshCw, QrCode, CheckCircle2, Trash2, RotateCw, CreditCard, AlertTriangle } from 'lucide-react';
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
  onReopenPix?: (subscription: ClientSubscription) => void;
  onConfirmPayment?: (subscription: ClientSubscription) => void;
  onDelete?: (subscription: ClientSubscription) => void;
  onReactivate?: (subscription: ClientSubscription) => void;
  /** Gera link de cobrança do ciclo atual (ACTIVE com ciclo não pago). */
  onChargeCycle?: (subscription: ClientSubscription) => void;
  /** Debita o ciclo atual direto no cartão salvo (ACTIVE não pago + hasCardOnFile). */
  onChargeCycleCard?: (subscription: ClientSubscription) => void;
  /** Confirma o pagamento do ciclo vigente já recebido (ACTIVE não pago, pagou por fora). */
  onConfirmCycle?: (subscription: ClientSubscription) => void;
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

function paymentMethodLabel(method?: string | null): string | null {
  if (method === 'PIX') return 'PIX';
  if (method === 'CARD') return 'Cartão';
  if (method === 'CASH') return 'Dinheiro';
  return null;
}

// Capitaliza a bandeira ("MASTERCARD" -> "Mastercard") para exibição amigável.
function formatCardBrand(brand?: string | null): string {
  if (!brand) return 'Cartão';
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
}

// Rótulo do cartão usado no pagamento: "Mastercard •••• 5431". Só quando há os 4
// dígitos (pagamento por cartão). Nunca expõe o número completo — só os 4 últimos.
function cardLabel(latestPayment?: ClientSubscription['latestPayment']): string | null {
  const last4 = latestPayment?.cardLast4;
  if (!last4) return null;
  return `${formatCardBrand(latestPayment?.cardBrand)} •••• ${last4}`;
}

export function ClientSubscriptionTable({
  subscriptions,
  onCancel,
  onUseCut,
  onResetCuts,
  onReopenPix,
  onConfirmPayment,
  onDelete,
  onReactivate,
  onChargeCycle,
  onChargeCycleCard,
  onConfirmCycle,
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
                Início
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Vencimento
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
                        {formatCurrency(plan?.price ?? 0)}/mês
                      </p>
                      {(cardLabel(subscription.latestPayment) ||
                        paymentMethodLabel(subscription.latestPayment?.method)) && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--hover-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                          <CreditCard className="h-3 w-3" />
                          {/* Mostra "Mastercard •••• 5431" quando pago no cartão;
                              senão o método (PIX/Dinheiro). */}
                          {cardLabel(subscription.latestPayment) ||
                            paymentMethodLabel(subscription.latestPayment?.method)}
                        </span>
                      )}
                      {/* Débito automático: assinatura ACTIVE (não cancelada) com cartão
                          tokenizado é renovada sozinha pelo cron perto do vencimento. Mesma
                          condição que torna o cron elegível (hasCardOnFile só existe se o
                          cliente pagou online no cartão → o cron debita aquele token). */}
                      {subscription.status === 'ACTIVE' &&
                        subscription.hasCardOnFile &&
                        !subscription.canceledAt && (
                          <span
                            title="Renova automaticamente no cartão salvo perto do vencimento"
                            className="ml-1 mt-1 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Renovação automática
                          </span>
                        )}
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
                    <div className="flex flex-col">
                      {/* Início do CICLO atual (muda todo mês) */}
                      <span className="text-sm text-[var(--text-secondary)]">
                        {formatDate(subscription.startDate)}
                      </span>
                      {/* Desde quando o cliente assina (data original — createdAt).
                          Só mostra se for diferente do início do ciclo (já é assinante
                          de um mês anterior), pra não repetir a mesma data. */}
                      {subscription.createdAt &&
                        formatDate(subscription.createdAt) !== formatDate(subscription.startDate) && (
                          <span className="text-xs text-[var(--text-muted)]">
                            assinante desde {formatDate(subscription.createdAt)}
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {subscription.endDate ? formatDate(subscription.endDate) : '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          subscription.canceledAt && subscription.status === 'ACTIVE'
                            ? 'bg-amber-500/15 text-amber-400'
                            : subscriptionStatusColors[subscription.status]
                        }`}
                      >
                        {subscription.canceledAt && subscription.status === 'ACTIVE'
                          ? `Cancela em ${subscription.endDate ? formatDate(subscription.endDate) : '—'}`
                          : subscriptionStatusLabels[subscription.status]}
                      </span>
                      {/* Estado de pagamento (precedência: Inadimplente > Ciclo não
                          pago > Em dia). "Ciclo não pago" = ACTIVE cujo mês vigente
                          ainda não foi pago (currentCyclePaid===false) — distinto do
                          status "Aguardando Pagamento" (PENDING_PAYMENT). */}
                      {subscription.inadimplente ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-500">
                          <AlertTriangle className="h-3 w-3" />
                          Inadimplente
                        </span>
                      ) : subscription.status === 'ACTIVE' &&
                        subscription.currentCyclePaid === false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          Ciclo não pago
                          {paymentMethodLabel(subscription.latestPayment?.method) && (
                            <span className="font-normal opacity-80">
                              · {paymentMethodLabel(subscription.latestPayment?.method)}
                            </span>
                          )}
                        </span>
                      ) : subscription.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-500">
                          <CheckCircle2 className="h-3 w-3" />
                          Em dia
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
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
                              setMenuPos({ top: rect.bottom + 4, left: rect.right - 200 });
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
                            className="fixed z-20 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] py-1 shadow-xl"
                            style={{ top: menuPos.top, left: menuPos.left }}
                          >
                            {subscription.status === 'ACTIVE' && (
                              <>
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
                                {/* Ciclo vigente não pago + cartão salvo: debita direto
                                    no cartão tokenizado, sem reabrir link nem renovar ciclo. */}
                                {onChargeCycleCard &&
                                  subscription.currentCyclePaid === false &&
                                  subscription.hasCardOnFile && (
                                    <button
                                      onClick={() => {
                                        onChargeCycleCard(subscription);
                                        setOpenMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                                    >
                                      <CreditCard className="h-4 w-4 text-green-600" />
                                      Cobrar no cartão
                                    </button>
                                  )}
                                {/* Ciclo vigente não pago: gera link de cobrança (PIX/cartão)
                                    do ciclo atual pra mandar pro cliente — sem renovar o ciclo. */}
                                {onChargeCycle && subscription.currentCyclePaid === false && (
                                  <button
                                    onClick={() => {
                                      onChargeCycle(subscription);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                                  >
                                    <CreditCard className="h-4 w-4 text-blue-500" />
                                    Gerar cobrança
                                  </button>
                                )}
                                {/* Cliente já pagou o mês por fora (balcão): registra o
                                    pagamento do ciclo sem renovar vencimento nem zerar cortes. */}
                                {onConfirmCycle && subscription.currentCyclePaid === false && (
                                  <button
                                    onClick={() => {
                                      onConfirmCycle(subscription);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Confirmar pagamento
                                  </button>
                                )}
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
                              </>
                            )}

                            {subscription.status === 'PENDING_PAYMENT' && (
                              <>
                                {onReopenPix && (
                                  <button
                                    onClick={() => {
                                      onReopenPix(subscription);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                                  >
                                    <QrCode className="h-4 w-4 text-blue-500" />
                                    Ver / Reenviar PIX
                                  </button>
                                )}
                                {onConfirmPayment && (
                                  <button
                                    onClick={() => {
                                      onConfirmPayment(subscription);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Confirmar pagamento manual
                                  </button>
                                )}
                                <div className="my-1 border-t border-[var(--border-color)]" />
                                <button
                                  onClick={() => {
                                    onCancel(subscription);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#A63030] hover:bg-red-500/10"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Cancelar
                                </button>
                                {onDelete && (
                                  <button
                                    onClick={() => {
                                      onDelete(subscription);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#A63030] hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Excluir do histórico
                                  </button>
                                )}
                              </>
                            )}

                            {(subscription.status === 'CANCELED' || subscription.status === 'EXPIRED' || subscription.status === 'SUSPENDED') && (
                              <>
                                {onReactivate && (
                                  <button
                                    onClick={() => {
                                      onReactivate(subscription);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                                  >
                                    <RotateCw className="h-4 w-4 text-[#C8923A]" />
                                    Renovar assinatura
                                  </button>
                                )}
                                {onDelete && (
                                  <>
                                    {onReactivate && <div className="my-1 border-t border-[var(--border-color)]" />}
                                    <button
                                      onClick={() => {
                                        onDelete(subscription);
                                        setOpenMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#A63030] hover:bg-red-500/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Excluir do histórico
                                    </button>
                                  </>
                                )}
                                {!onReactivate && !onDelete && (
                                  <div className="px-4 py-3 text-xs text-[var(--text-muted)]">
                                    Nenhuma ação disponível
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
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
