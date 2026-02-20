import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { Client } from '@/types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  client: Client | null;
  isLoading: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  client,
  isLoading,
}: ConfirmDeleteModalProps) {
  if (!client) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Excluir Cliente" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-red-500/20 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[#A63030]" />
          <div>
            <p className="font-medium text-[#A63030]">Atenção</p>
            <p className="text-sm text-[#C45050]">
              Tem certeza que deseja excluir o cliente <strong>{client.name}</strong>?
            </p>
            <p className="mt-1 text-sm text-[#C45050]/80">
              O cliente será desativado e não aparecerá mais na lista.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
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
            className="flex items-center gap-2 rounded-xl bg-[#8B2020] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B1818] disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
