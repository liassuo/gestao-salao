import { useState } from 'react';
import { Receipt, AlertCircle, Plus } from 'lucide-react';
import {
  useDebts,
  useDebtActions,
  useCreateDebt,
  usePayDebt,
  useSettleDebt,
  getApiErrorMessage,
} from '@/hooks';
import {
  ConfirmDeleteModal,
  ConfirmSettleModal,
  DebtFilters,
  DebtForm,
  DebtPaymentModal,
  DebtSummary,
  DebtsTable,
} from '@/components/debts';
import { Modal, SkeletonTable, SkeletonSummaryCards, useToast } from '@/components/ui';
import type { Debt, DebtFilters as DebtFiltersType, CreateDebtPayload, PartialPaymentPayload } from '@/types';

export function Debts() {
  const [filters, setFilters] = useState<DebtFiltersType>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [settleDebt, setSettleDebt] = useState<Debt | null>(null);
  const [deleteDebt, setDeleteDebt] = useState<Debt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: debts, isLoading, isError, error } = useDebts(filters);
  const { remove, isLoading: isDeleting } = useDebtActions();
  const createDebt = useCreateDebt();
  const payDebt = usePayDebt();
  const settleDebtMutation = useSettleDebt();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleCreateDebt = async (payload: CreateDebtPayload) => {
    setFormError(null);
    try {
      await createDebt.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Dívida registrada', 'A dívida foi registrada com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleOpenPaymentModal = (debt: Debt) => {
    setPaymentError(null);
    setPaymentDebt(debt);
  };

  const handleClosePaymentModal = () => {
    setPaymentDebt(null);
    setPaymentError(null);
  };

  const handlePayDebt = async (payload: PartialPaymentPayload) => {
    if (!paymentDebt) return;
    setPaymentError(null);
    try {
      await payDebt.mutateAsync({ id: paymentDebt.id, payload });
      handleClosePaymentModal();
      toast.success('Pagamento registrado', 'O pagamento parcial foi registrado com sucesso.');
    } catch (err) {
      setPaymentError(getApiErrorMessage(err));
    }
  };

  const handleOpenSettleModal = (debt: Debt) => {
    setSettleDebt(debt);
  };

  const handleCloseSettleModal = () => {
    setSettleDebt(null);
  };

  const handleSettleDebt = async () => {
    if (!settleDebt) return;
    try {
      await settleDebtMutation.mutateAsync(settleDebt.id);
      handleCloseSettleModal();
      toast.success('Dívida quitada', 'A dívida foi marcada como quitada.');
    } catch {
      toast.error('Erro', 'Não foi possível quitar a dívida.');
    }
  };

  const handleOpenDeleteModal = (debt: Debt) => {
    setDeleteDebt(debt);
  };

  const handleCloseDeleteModal = () => {
    setDeleteDebt(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteDebt) return;
    try {
      await remove(deleteDebt.id);
      handleCloseDeleteModal();
      toast.success('Dívida excluída', 'A dívida foi excluída com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir a dívida.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
            <Receipt className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dívidas (Fiado)</h1>
            <p className="text-sm text-gray-500">
              Gerencie as dívidas dos clientes
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
        >
          <Plus className="h-5 w-5" />
          Nova Dívida
        </button>
      </div>

      {/* Resumo */}
      {isLoading ? (
        <SkeletonSummaryCards count={4} />
      ) : (
        <DebtSummary debts={debts || []} isLoading={false} />
      )}

      {/* Filtros */}
      <DebtFilters filters={filters} onChange={setFilters} />

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : isError ? (
        <div className="rounded-xl bg-red-50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Erro ao carregar</h3>
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <DebtsTable
          debts={debts || []}
          onPay={handleOpenPaymentModal}
          onSettle={handleOpenSettleModal}
          onDelete={handleOpenDeleteModal}
          isLoading={isDeleting || payDebt.isPending || settleDebtMutation.isPending}
          onNewDebt={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Nova Dívida"
        size="lg"
      >
        <DebtForm
          onSubmit={handleCreateDebt}
          isLoading={createDebt.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de pagamento parcial */}
      <DebtPaymentModal
        isOpen={!!paymentDebt}
        onClose={handleClosePaymentModal}
        onSubmit={handlePayDebt}
        debt={paymentDebt}
        isLoading={payDebt.isPending}
        error={paymentError}
      />

      {/* Modal de confirmação de quitação */}
      <ConfirmSettleModal
        isOpen={!!settleDebt}
        onClose={handleCloseSettleModal}
        onConfirm={handleSettleDebt}
        debt={settleDebt}
        isLoading={settleDebtMutation.isPending}
      />

      {/* Modal de confirmação de exclusão */}
      <ConfirmDeleteModal
        isOpen={!!deleteDebt}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        debt={deleteDebt}
        isLoading={isDeleting}
      />
    </div>
  );
}
