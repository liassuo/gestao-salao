import { useState } from 'react';
import { Landmark, AlertCircle, Plus } from 'lucide-react';
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  getApiErrorMessage,
} from '@/hooks';
import { BankAccountsTable, BankAccountForm } from '@/components/bank-accounts';
import { Modal, ConfirmModal, SkeletonTable, useToast } from '@/components/ui';
import type { BankAccount, CreateBankAccountPayload, UpdateBankAccountPayload } from '@/types';

export function BankAccounts() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: bankAccounts, isLoading, isError, error } = useBankAccounts();
  const createBankAccount = useCreateBankAccount();
  const updateBankAccount = useUpdateBankAccount();
  const deleteBankAccount = useDeleteBankAccount();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (account: BankAccount) => {
    setFormError(null);
    setEditingAccount(account);
  };

  const handleCloseEditModal = () => {
    setEditingAccount(null);
    setFormError(null);
  };

  const handleCreateBankAccount = async (payload: CreateBankAccountPayload) => {
    setFormError(null);
    try {
      await createBankAccount.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Conta cadastrada', 'A conta bancária foi cadastrada com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateBankAccount = async (payload: UpdateBankAccountPayload) => {
    if (!editingAccount) return;
    setFormError(null);
    try {
      await updateBankAccount.mutateAsync({ id: editingAccount.id, payload });
      handleCloseEditModal();
      toast.success('Conta atualizada', 'Os dados da conta bancária foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteBankAccount = async () => {
    if (!deletingAccount) return;
    try {
      await deleteBankAccount.mutateAsync(deletingAccount.id);
      setDeletingAccount(null);
      toast.success('Conta excluída', 'A conta bancária foi desativada com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir a conta bancária.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <Landmark className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contas Bancárias</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie as contas bancárias da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Nova Conta
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
        <BankAccountsTable
          bankAccounts={bankAccounts || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingAccount}
          isLoading={deleteBankAccount.isPending}
          onNewBankAccount={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Nova Conta Bancária"
      >
        <BankAccountForm
          onSubmit={handleCreateBankAccount}
          isLoading={createBankAccount.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingAccount}
        onClose={handleCloseEditModal}
        title="Editar Conta Bancária"
      >
        <BankAccountForm
          bankAccount={editingAccount}
          onSubmit={handleUpdateBankAccount as (payload: CreateBankAccountPayload) => Promise<void>}
          isLoading={updateBankAccount.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDeleteBankAccount}
        title="Excluir Conta Bancária"
        message={`Tem certeza que deseja excluir a conta "${deletingAccount?.name}"? Esta ação irá desativá-la.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteBankAccount.isPending}
      />
    </div>
  );
}
