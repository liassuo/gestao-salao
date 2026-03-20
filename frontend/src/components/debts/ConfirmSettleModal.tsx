import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Debt } from '@/types';
import { paymentMethodLabels } from '@/types';

interface ConfirmSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: string) => Promise<void>;
  debt: Debt | null;
  isLoading: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const methodOptions = ['CASH', 'PIX', 'CARD'] as const;

export function ConfirmSettleModal({
  isOpen,
  onClose,
  onConfirm,
  debt,
  isLoading,
}: ConfirmSettleModalProps) {
  const [method, setMethod] = useState<string>('CASH');

  if (!isOpen || !debt) return null;

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
              <AlertTriangle className="h-6 w-6 text-[#A63030]" />
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
          <div className="mb-4 rounded-xl bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Cliente:</span> {debt.client?.name || 'Cliente'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Valor total:</span>{' '}
              {formatCurrency(debt.amount)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Já pago:</span>{' '}
              <span className="text-[#C8923A]">
                {formatCurrency(debt.amountPaid)}
              </span>
            </p>
            {debt.remainingBalance > 0 && (
              <p className="mt-2 border-t border-[var(--border-color)] pt-2 text-sm font-medium text-[var(--text-primary)]">
                Valor a quitar:{' '}
                <span className="text-[#A63030]">
                  {formatCurrency(debt.remainingBalance)}
                </span>
              </p>
            )}
          </div>

          {/* Método de Pagamento */}
          {debt.remainingBalance > 0 && (
            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Forma de Pagamento
              </label>
              <div className="flex gap-2">
                {methodOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      method === m
                        ? 'border-[#C8923A] bg-[#C8923A]/20 text-[#C8923A]'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    {paymentMethodLabels[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              onClick={() => onConfirm(method)}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
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
