import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Debt } from '@/types';

interface ConfirmDeleteModalProps {
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

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  debt,
  isLoading,
}: ConfirmDeleteModalProps) {
  if (!isOpen || !debt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Excluir Dívida
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
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Confirmar exclusão
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Tem certeza que deseja excluir esta dívida? Esta ação não pode
                ser desfeita.
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
            {debt.description && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Descrição:</span>{' '}
                {debt.description}
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
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
