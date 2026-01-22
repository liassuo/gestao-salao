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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Quitar Dívida
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Confirmar quitação
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Tem certeza que deseja marcar esta dívida como quitada?
              </p>
            </div>
          </div>

          {/* Info da Dívida */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Cliente:</span> {debt.client.name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Valor total:</span>{' '}
              {formatCurrency(debt.amount)}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Já pago:</span>{' '}
              <span className="text-green-600">
                {formatCurrency(debt.amountPaid)}
              </span>
            </p>
            {hasRemainingBalance && (
              <p className="mt-2 border-t border-gray-200 pt-2 text-sm text-yellow-700">
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
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
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
