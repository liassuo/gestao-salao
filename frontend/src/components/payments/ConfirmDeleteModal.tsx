import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { Payment } from '@/types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  payment: Payment | null;
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
  payment,
  isLoading,
}: ConfirmDeleteModalProps) {
  if (!payment) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Excluir Pagamento" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir este pagamento?
            </p>
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="font-medium text-gray-800">{payment.client.name}</p>
              <p className="text-sm text-gray-500">
                {formatCurrency(payment.amount)}
              </p>
            </div>
            <p className="mt-3 text-sm text-red-600">
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
