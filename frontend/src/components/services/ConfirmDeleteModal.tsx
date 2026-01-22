import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { Service } from '@/types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  service: Service | null;
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
  service,
  isLoading,
}: ConfirmDeleteModalProps) {
  if (!service) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Excluir Serviço" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Atenção</p>
            <p className="text-sm text-yellow-700">
              Tem certeza que deseja excluir o serviço <strong>{service.name}</strong>?
            </p>
            <p className="mt-1 text-sm text-yellow-600">
              Preço: {formatCurrency(service.price)}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
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
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
