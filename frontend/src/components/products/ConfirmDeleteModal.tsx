import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { Product } from '@/types';

interface ConfirmDeleteModalProps {
  product: Product;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({ product, isOpen, isLoading, onConfirm, onClose }: ConfirmDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Desativar Produto">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-400 mt-0.5" />
          <div>
            <p className="text-[var(--text-primary)]">Tem certeza que deseja desativar o produto <strong>{product.name}</strong>?</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">O produto será marcado como inativo e não aparecerá mais nas listagens.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">Cancelar</button>
          <button onClick={onConfirm} disabled={isLoading} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{isLoading ? 'Desativando...' : 'Desativar'}</button>
        </div>
      </div>
    </Modal>
  );
}
