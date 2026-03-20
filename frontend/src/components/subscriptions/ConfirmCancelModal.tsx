import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { ClientSubscription } from '@/types';

interface ConfirmCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  subscription: ClientSubscription | null;
  isLoading: boolean;
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

export function ConfirmCancelModal({
  isOpen,
  onClose,
  onConfirm,
  subscription,
  isLoading,
}: ConfirmCancelModalProps) {
  if (!isOpen || !subscription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Cancelar Assinatura
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
              <AlertTriangle className="h-6 w-6 text-[#A63030]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-primary)]">
                Confirmar cancelamento
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Tem certeza que deseja cancelar esta assinatura?
              </p>
            </div>
          </div>

          {/* Info da Assinatura */}
          <div className="mb-6 rounded-xl bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Cliente:</span> {subscription.client?.name || 'Cliente'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Plano:</span> {subscription.plan?.name || 'Plano'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Valor:</span>{' '}
              {formatCurrency(subscription.plan?.price ?? 0)}/mês
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Início:</span>{' '}
              {formatDate(subscription.startDate)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Cortes usados este mês:</span>{' '}
              {subscription.cutsUsedThisMonth} / {(subscription.plan?.cutsPerMonth ?? 0) === 99 ? '∞' : subscription.plan?.cutsPerMonth ?? 0}
            </p>
          </div>

          <div className="mb-6 rounded-xl bg-red-500/10 p-3">
            <p className="text-sm text-[#A63030]">
              <span className="font-medium">Atenção:</span> Esta ação não pode ser desfeita.
              O cliente perderá acesso aos benefícios do plano imediatamente.
            </p>
          </div>

          {/* Botoes */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-[#8B2020] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B1818] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
