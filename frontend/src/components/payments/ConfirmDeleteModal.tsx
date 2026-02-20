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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-6 w-6 text-[#A63030]" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">
              Tem certeza que deseja excluir este pagamento?
            </p>
            <div className="mt-3 rounded-xl bg-[var(--hover-bg)] p-3">
              <p className="font-medium text-[var(--text-primary)]">{payment.client?.name || 'Cliente'}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {formatCurrency(payment.amount)}
              </p>
            </div>
            <p className="mt-3 text-sm text-[#A63030]">
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-[#8B2020] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B1818] disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
