import { AlertCircle, BadgeCheck, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useSyncSubscriptionWithAsaas, useConfirmSubscriptionPayment } from '@/hooks';
import { useToast } from '@/components/ui/ToastContext';
import { UNLIMITED_CUTS } from '@/utils';

interface Props {
  /** ID da assinatura — necessário para acionar sync/confirm. */
  subscriptionId: string | undefined;
  status: string | undefined;
  planName: string | undefined;
  remainingCuts: number;
  cutsPerMonth: number;
  /** Texto contextual do contexto (ex: "agendamento", "comanda"). Usado nas mensagens. */
  context?: string;
}

/**
 * Banner reutilizável de status da assinatura do cliente.
 * Mostra o plano ativo + saldo de cortes quando ACTIVE; surfaces
 * PENDING_PAYMENT/SUSPENDED/CANCELED com CTAs de reconciliação para
 * que o admin não cobre cheio sem perceber.
 */
export function SubscriptionStatusBanner({
  subscriptionId,
  status,
  planName,
  remainingCuts,
  cutsPerMonth,
  context = 'agendamento',
}: Props) {
  const toast = useToast();
  const syncSubscription = useSyncSubscriptionWithAsaas();
  const confirmSubscription = useConfirmSubscriptionPayment();

  const handleSync = async () => {
    if (!subscriptionId) return;
    try {
      const updated = await syncSubscription.mutateAsync(subscriptionId);
      if (updated.status === 'ACTIVE') {
        toast.success('Assinatura ativada', 'Pagamento reconciliado com o Asaas');
      } else {
        toast.warning(
          'Sem pagamento confirmado no Asaas',
          'Se o cliente já pagou, use "Confirmar manualmente"',
        );
      }
    } catch (err: any) {
      toast.error(
        'Falha na reconciliação',
        err?.response?.data?.message || err?.message || 'Tente novamente',
      );
    }
  };

  const handleConfirm = async () => {
    if (!subscriptionId) return;
    try {
      await confirmSubscription.mutateAsync(subscriptionId);
      toast.success('Assinatura ativada', 'Pagamento confirmado manualmente');
    } catch (err: any) {
      toast.error(
        'Falha ao confirmar',
        err?.response?.data?.message || err?.message || 'Tente novamente',
      );
    }
  };

  if (status === 'ACTIVE') {
    const unlimited = cutsPerMonth === UNLIMITED_CUTS;
    const cutsLabel = unlimited
      ? 'cortes ilimitados'
      : remainingCuts > 0
      ? `${remainingCuts} de ${cutsPerMonth} cortes restantes no mês`
      : `limite mensal atingido (${cutsPerMonth}/${cutsPerMonth})`;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
        <BadgeCheck className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <span className="font-medium">Plano {planName ?? 'ativo'}</span>
          <span className="text-emerald-700/80"> — {cutsLabel}</span>
        </span>
      </div>
    );
  }

  if (status === 'PENDING_PAYMENT') {
    const isSyncing = syncSubscription.isPending;
    const isConfirming = confirmSubscription.isPending;
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <div className="mb-2 flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              Plano {planName ?? ''} aguardando confirmação de pagamento
            </p>
            <p className="text-xs text-amber-700/80">
              Enquanto não for ativado, o desconto da assinatura NÃO será aplicado neste {context}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || isConfirming || !subscriptionId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reconciliar com Asaas
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSyncing || isConfirming || !subscriptionId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Confirmar manualmente
          </button>
        </div>
      </div>
    );
  }

  if (status === 'SUSPENDED') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Plano {planName ?? ''} suspenso (vencido). Sem desconto até o cliente renovar.</span>
      </div>
    );
  }

  if (status === 'CANCELED') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <span>Plano {planName ?? ''} cancelado — sem desconto.</span>
      </div>
    );
  }

  return null;
}
