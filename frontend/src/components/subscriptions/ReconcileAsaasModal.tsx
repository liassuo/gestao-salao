import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Modal, useToast } from '@/components/ui';
import { subscriptionsService } from '@/services/subscriptions';

type ReconcileIssue = {
  asaasPaymentId: string;
  asaasStatus: string;
  amount: number;
  confirmedAt: string | null;
  issue: 'PAYMENT_MISSING' | 'PAYMENT_UNPAID' | 'APPOINTMENT_CANCELED';
  kind: 'subscription' | 'appointment' | 'unknown';
  clientName: string | null;
  description: string;
  suggestedAction: string;
};

const issueLabels: Record<ReconcileIssue['issue'], { label: string; color: string }> = {
  PAYMENT_MISSING: { label: 'Pagamento ausente', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  PAYMENT_UNPAID: { label: 'Não marcado como pago', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  APPOINTMENT_CANCELED: { label: 'Agendamento cancelado', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const kindLabels: Record<ReconcileIssue['kind'], string> = {
  subscription: 'Assinatura',
  appointment: 'Agendamento',
  unknown: '—',
};

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function ReconcileAsaasModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [days, setDays] = useState<7 | 15 | 30>(7);
  const [issues, setIssues] = useState<ReconcileIssue[]>([]);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [configured, setConfigured] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await subscriptionsService.getReconcileReport(days);
      setIssues(result.issues);
      setConfigured(result.configured);
      if (!result.configured) {
        toast.warning('Asaas não configurado', 'A integração com o Asaas não está ativa neste servidor.');
      }
    } catch (err: any) {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível carregar o relatório.');
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleResolve = async (issue: ReconcileIssue) => {
    setResolvingIds((prev) => new Set(prev).add(issue.asaasPaymentId));
    try {
      const result = await subscriptionsService.applyReconciliation(issue.asaasPaymentId);
      if (result.success) {
        toast.success('Resolvido', result.message);
        // Remove a linha resolvida
        setIssues((prev) => prev.filter((i) => i.asaasPaymentId !== issue.asaasPaymentId));
      } else {
        toast.error('Não foi possível resolver', result.message);
      }
    } catch (err: any) {
      toast.error('Erro', err?.response?.data?.message || 'Falha ao resolver pagamento.');
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(issue.asaasPaymentId);
        return next;
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reconciliar com Asaas" size="xl">
      <div className="space-y-4">
        {/* Header com filtro e refresh */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span>Verificando os últimos</span>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) as 7 | 15 | 30)}
              disabled={isLoading}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-2 py-1 text-sm text-[var(--text-primary)]"
            >
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Avisos */}
        {!configured && !isLoading && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400">
            A integração com o Asaas não está configurada neste servidor.
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando...
          </div>
        ) : issues.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <Check className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
            <p className="font-medium text-emerald-400">Tudo conferido</p>
            <p className="text-sm text-[var(--text-muted)]">
              Não há cobranças do Asaas desalinhadas no período.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => {
              const isResolving = resolvingIds.has(issue.asaasPaymentId);
              const badge = issueLabels[issue.issue];
              return (
                <div
                  key={issue.asaasPaymentId}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{kindLabels[issue.kind]}</span>
                        <span className="text-xs font-mono text-[var(--text-muted)]">
                          {issue.asaasPaymentId.slice(0, 18)}…
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{issue.description}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--text-muted)]">
                        <span>Valor: <span className="text-[var(--text-secondary)]">{formatCurrency(issue.amount)}</span></span>
                        <span>Confirmado: <span className="text-[var(--text-secondary)]">{formatDate(issue.confirmedAt)}</span></span>
                        <span>Status Asaas: <span className="text-[var(--text-secondary)]">{issue.asaasStatus}</span></span>
                      </div>
                      <p className="mt-2 text-xs italic text-[#C8923A]">→ {issue.suggestedAction}</p>
                    </div>
                    <button
                      onClick={() => handleResolve(issue)}
                      disabled={isResolving}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Resolver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-muted)]">
          <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-400" />
          O botão "Resolver" registra o pagamento no caixa, ativa a assinatura ou restaura o agendamento — conforme o caso. É idempotente: pode clicar duas vezes sem duplicar.
        </div>

        <div className="flex justify-end border-t border-[var(--border-color)] pt-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
          >
            <X className="h-4 w-4" />
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
