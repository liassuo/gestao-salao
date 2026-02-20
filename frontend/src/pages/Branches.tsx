import { useState } from 'react';
import { Building2, AlertCircle, Plus } from 'lucide-react';
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeleteBranch,
  getApiErrorMessage,
} from '@/hooks';
import { BranchesTable, BranchForm } from '@/components/branches';
import { Modal, ConfirmModal, SkeletonTable, useToast } from '@/components/ui';
import type { Branch, CreateBranchPayload, UpdateBranchPayload } from '@/types';

export function Branches() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: branches, isLoading, isError, error } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (branch: Branch) => {
    setFormError(null);
    setEditingBranch(branch);
  };

  const handleCloseEditModal = () => {
    setEditingBranch(null);
    setFormError(null);
  };

  const handleCreateBranch = async (payload: CreateBranchPayload) => {
    setFormError(null);
    try {
      await createBranch.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Filial cadastrada', 'A filial foi cadastrada com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateBranch = async (payload: UpdateBranchPayload) => {
    if (!editingBranch) return;
    setFormError(null);
    try {
      await updateBranch.mutateAsync({ id: editingBranch.id, payload });
      handleCloseEditModal();
      toast.success('Filial atualizada', 'Os dados da filial foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    try {
      await deleteBranch.mutateAsync(deletingBranch.id);
      setDeletingBranch(null);
      toast.success('Filial excluída', 'A filial foi desativada com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir a filial.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <Building2 className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Filiais</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie as filiais da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Nova Filial
        </button>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
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
        <BranchesTable
          branches={branches || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingBranch}
          isLoading={deleteBranch.isPending}
          onNewBranch={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Nova Filial"
      >
        <BranchForm
          onSubmit={handleCreateBranch}
          isLoading={createBranch.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingBranch}
        onClose={handleCloseEditModal}
        title="Editar Filial"
      >
        <BranchForm
          branch={editingBranch}
          onSubmit={handleUpdateBranch as (payload: CreateBranchPayload) => Promise<void>}
          isLoading={updateBranch.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deletingBranch}
        onClose={() => setDeletingBranch(null)}
        onConfirm={handleDeleteBranch}
        title="Excluir Filial"
        message={`Tem certeza que deseja excluir a filial "${deletingBranch?.name}"? Esta ação irá desativá-la.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteBranch.isPending}
      />
    </div>
  );
}
