import { useState } from 'react';
import { CreditCard, AlertCircle, Plus } from 'lucide-react';
import {
  usePayments,
  usePaymentTotals,
  usePaymentActions,
  useCreatePayment,
  getApiErrorMessage,
} from '@/hooks';
import {
  ConfirmDeleteModal,
  PaymentForm,
  PaymentsTable,
  PaymentTotals,
} from '@/components/payments';
import { Modal, SkeletonTable, SkeletonSummaryCards, useToast } from '@/components/ui';
import type { Payment, CreatePaymentPayload } from '@/types';

export function Payments() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: payments, isLoading, isError, error } = usePayments();
  const { data: totals, isLoading: isLoadingTotals } = usePaymentTotals();
  const { remove, isLoading: isActionLoading } = usePaymentActions();
  const createPayment = useCreatePayment();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleCreatePayment = async (payload: CreatePaymentPayload) => {
    setFormError(null);
    try {
      await createPayment.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Pagamento registrado', 'O pagamento foi registrado com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleEditPayment = (payment: Payment) => {
    toast.info('Em breve', 'A edição de pagamentos será implementada em breve.');
    void payment;
  };

  const handleDeletePayment = (payment: Payment) => {
    setDeletePayment(payment);
  };

  const handleConfirmDelete = async () => {
    if (!deletePayment) return;
    try {
      await remove(deletePayment.id);
      setDeletePayment(null);
      toast.success('Pagamento excluído', 'O pagamento foi excluído com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir o pagamento.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
            <CreditCard className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pagamentos</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie os pagamentos da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Novo Pagamento
        </button>
      </div>

      {/* Totais */}
      {isLoadingTotals ? (
        <SkeletonSummaryCards count={4} />
      ) : (
        <PaymentTotals
          totals={totals || { cash: 0, pix: 0, card: 0, total: 0 }}
          isLoading={false}
        />
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-500">Erro ao carregar</h3>
              <p className="text-sm text-red-400">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <PaymentsTable
          payments={payments || []}
          onEdit={handleEditPayment}
          onDelete={handleDeletePayment}
          isLoading={isActionLoading}
          onNewPayment={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Novo Pagamento"
        size="lg"
      >
        <PaymentForm
          onSubmit={handleCreatePayment}
          isLoading={createPayment.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmDeleteModal
        isOpen={!!deletePayment}
        onClose={() => setDeletePayment(null)}
        onConfirm={handleConfirmDelete}
        payment={deletePayment}
        isLoading={isActionLoading}
      />
    </div>
  );
}
