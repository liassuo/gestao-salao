import { useState } from 'react';
import { UserCog, AlertCircle, Plus } from 'lucide-react';
import {
  useProfessionals,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  getApiErrorMessage,
} from '@/hooks';
import { ProfessionalsTable, ProfessionalForm, ConfirmDeleteModal } from '@/components/professionals';
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type { Professional, CreateProfessionalPayload, UpdateProfessionalPayload } from '@/types';

export function Professionals() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [deletingProfessional, setDeletingProfessional] = useState<Professional | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: professionals, isLoading, isError, error } = useProfessionals();
  const createProfessional = useCreateProfessional();
  const updateProfessional = useUpdateProfessional();
  const deleteProfessional = useDeleteProfessional();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (professional: Professional) => {
    setFormError(null);
    setEditingProfessional(professional);
  };

  const handleCloseEditModal = () => {
    setEditingProfessional(null);
    setFormError(null);
  };

  const handleCreateProfessional = async (payload: CreateProfessionalPayload) => {
    setFormError(null);
    try {
      await createProfessional.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Profissional cadastrado', 'O profissional foi cadastrado com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateProfessional = async (payload: UpdateProfessionalPayload) => {
    if (!editingProfessional) return;
    setFormError(null);
    try {
      await updateProfessional.mutateAsync({ id: editingProfessional.id, payload });
      handleCloseEditModal();
      toast.success('Profissional atualizado', 'Os dados do profissional foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteProfessional = async () => {
    if (!deletingProfessional) return;
    try {
      await deleteProfessional.mutateAsync(deletingProfessional.id);
      setDeletingProfessional(null);
      toast.success('Profissional excluído', 'O profissional foi desativado com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir o profissional.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
            <UserCog className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Profissionais</h1>
            <p className="text-sm text-gray-500">
              Gerencie os profissionais da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          <Plus className="h-5 w-5" />
          Novo Profissional
        </button>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : isError ? (
        <div className="rounded-xl bg-red-50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Erro ao carregar</h3>
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ProfessionalsTable
          professionals={professionals || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingProfessional}
          isLoading={deleteProfessional.isPending}
          onNewProfessional={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Novo Profissional"
      >
        <ProfessionalForm
          onSubmit={handleCreateProfessional}
          isLoading={createProfessional.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingProfessional}
        onClose={handleCloseEditModal}
        title="Editar Profissional"
      >
        <ProfessionalForm
          professional={editingProfessional}
          onSubmit={handleUpdateProfessional as (payload: CreateProfessionalPayload) => Promise<void>}
          isLoading={updateProfessional.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmDeleteModal
        isOpen={!!deletingProfessional}
        onClose={() => setDeletingProfessional(null)}
        onConfirm={handleDeleteProfessional}
        professional={deletingProfessional}
        isLoading={deleteProfessional.isPending}
      />
    </div>
  );
}
