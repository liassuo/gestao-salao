import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Debt } from '@/types';

interface ConfirmSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  debt: Debt | null;
  isLoading: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ConfirmSettleModal({
  isOpen,
  onClose,
  onConfirm,
  debt,
  isLoading,
}: ConfirmSettleModalProps) {
  if (!isOpen || !debt) return null;

  const hasRemainingBalance = debt.remainingBalance > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Quitar Dívida
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
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-primary)]">
                Confirmar quitação
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Tem certeza que deseja marcar esta dívida como quitada?
              </p>
            </div>
          </div>

          {/* Info da Dívida */}
          <div className="mb-6 rounded-xl bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Cliente:</span> {debt.client.name}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Valor total:</span>{' '}
              {formatCurrency(debt.amount)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Já pago:</span>{' '}
              <span className="text-blue-500">
                {formatCurrency(debt.amountPaid)}
              </span>
            </p>
            {hasRemainingBalance && (
              <p className="mt-2 border-t border-[var(--border-color)] pt-2 text-sm text-red-500">
                <span className="font-medium">Atenção:</span> Esta dívida ainda
                possui saldo de{' '}
                <span className="font-semibold">
                  {formatCurrency(debt.remainingBalance)}
                </span>{' '}
                que será perdoado.
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Quitando...' : 'Confirmar Quitação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
