import { useState } from 'react';
import { CreditCard, AlertCircle, Plus } from 'lucide-react';
import {
  usePaymentMethodConfigs,
  useCreatePaymentMethodConfig,
  useUpdatePaymentMethodConfig,
  useDeletePaymentMethodConfig,
  getApiErrorMessage,
} from '@/hooks';
import { PaymentMethodsTable, PaymentMethodForm } from '@/components/payment-methods';
import { Modal, ConfirmModal, SkeletonTable, useToast } from '@/components/ui';
import type { PaymentMethodConfig, CreatePaymentMethodConfigPayload, UpdatePaymentMethodConfigPayload } from '@/types';

export function PaymentMethods() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethodConfig | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: paymentMethods, isLoading, isError, error } = usePaymentMethodConfigs();
  const createMethod = useCreatePaymentMethodConfig();
  const updateMethod = useUpdatePaymentMethodConfig();
  const deleteMethod = useDeletePaymentMethodConfig();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (method: PaymentMethodConfig) => {
    setFormError(null);
    setEditingMethod(method);
  };

  const handleCloseEditModal = () => {
    setEditingMethod(null);
    setFormError(null);
  };

  const handleCreateMethod = async (payload: CreatePaymentMethodConfigPayload) => {
    setFormError(null);
    try {
      await createMethod.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Forma de pagamento cadastrada', 'A forma de pagamento foi cadastrada com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateMethod = async (payload: UpdatePaymentMethodConfigPayload) => {
    if (!editingMethod) return;
    setFormError(null);
    try {
      await updateMethod.mutateAsync({ id: editingMethod.id, payload });
      handleCloseEditModal();
      toast.success('Forma de pagamento atualizada', 'Os dados da forma de pagamento foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteMethod = async () => {
    if (!deletingMethod) return;
    try {
      await deleteMethod.mutateAsync(deletingMethod.id);
      setDeletingMethod(null);
      toast.success('Forma de pagamento excluída', 'A forma de pagamento foi desativada com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir a forma de pagamento.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <CreditCard className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Formas de Pagamento</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie as formas de pagamento da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Nova Forma de Pagamento
        </button>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-[#A63030]" />
            <div>
              <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
              <p className="text-sm text-[#C45050]">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <PaymentMethodsTable
          paymentMethods={paymentMethods || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingMethod}
          isLoading={deleteMethod.isPending}
          onNewPaymentMethod={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Nova Forma de Pagamento"
      >
        <PaymentMethodForm
          onSubmit={handleCreateMethod}
          isLoading={createMethod.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingMethod}
        onClose={handleCloseEditModal}
        title="Editar Forma de Pagamento"
      >
        <PaymentMethodForm
          paymentMethod={editingMethod}
          onSubmit={handleUpdateMethod as (payload: CreatePaymentMethodConfigPayload) => Promise<void>}
          isLoading={updateMethod.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deletingMethod}
        onClose={() => setDeletingMethod(null)}
        onConfirm={handleDeleteMethod}
        title="Excluir Forma de Pagamento"
        message={`Tem certeza que deseja excluir a forma de pagamento "${deletingMethod?.name}"? Esta ação irá desativá-la.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteMethod.isPending}
      />
    </div>
  );
}
