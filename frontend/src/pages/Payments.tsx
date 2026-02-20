import { useState, useMemo } from 'react';
import { CreditCard, AlertCircle, Plus, Search } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const { data: payments, isLoading, isError, error } = usePayments();

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    return payments.filter((p) => {
      if (methodFilter && p.method !== methodFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return p.client?.name?.toLowerCase().includes(term) || p.notes?.toLowerCase().includes(term);
      }
      return true;
    });
  }, [payments, searchTerm, methodFilter]);
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <CreditCard className="h-5 w-5 text-[#C8923A]" />
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
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Novo Pagamento
        </button>
      </div>

      {/* Busca e filtros */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente ou observação..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
          />
        </div>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
        >
          <option value="">Todos os métodos</option>
          <option value="CASH">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="CARD">Cartão</option>
        </select>
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
            <AlertCircle className="h-6 w-6 text-[#A63030]" />
            <div>
              <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
              <p className="text-sm text-[#C45050]">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <PaymentsTable
          payments={filteredPayments}
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
