import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { Client } from '@/types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  client: Client | null;
  isLoading: boolean;
  mode?: 'active' | 'inactive';
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  client,
  isLoading,
  mode = 'active',
}: ConfirmDeleteModalProps) {
  if (!client) return null;

  const isPermanent = mode === 'inactive';
  const title = isPermanent ? 'Excluir Cliente' : 'Inativar Cliente';
  const verb = isPermanent ? 'excluir permanentemente' : 'inativar';
  const description = isPermanent
    ? 'Esta ação não pode ser desfeita. O cliente será removido em definitivo da base de dados.'
    : 'O cliente será movido para a aba de Inativos e não aparecerá mais na lista de ativos. Você pode reativá-lo depois.';
  const confirmLabel = isPermanent ? 'Excluir' : 'Inativar';
  const loadingLabel = isPermanent ? 'Excluindo...' : 'Inativando...';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-red-500/20 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[#A63030]" />
          <div>
            <p className="font-medium text-[#A63030]">Atenção</p>
            <p className="text-sm text-[#C45050]">
              Tem certeza que deseja {verb} o cliente <strong>{client.name}</strong>?
            </p>
            <p className="mt-1 text-sm text-[#C45050]/80">
              {description}
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
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
