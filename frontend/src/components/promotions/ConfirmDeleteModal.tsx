import { ConfirmModal } from '@/components/ui';
import type { Promotion } from '@/types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  promotion: Promotion | null;
  isLoading: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  promotion,
  isLoading,
}: ConfirmDeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Excluir Promoção"
      message={`Tem certeza que deseja excluir a promoção "${promotion?.name}"? Esta ação não pode ser desfeita.`}
      confirmLabel="Excluir"
      isLoading={isLoading}
      variant="danger"
    />
  );
}
