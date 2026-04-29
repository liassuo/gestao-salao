import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserCog, AlertCircle, Plus, Search } from 'lucide-react';
import {
  useProfessionals,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  getApiErrorMessage,
} from '@/hooks';
import {
  ProfessionalsTable,
  ProfessionalForm,
  ConfirmDeleteModal,
  VacationsManager,
} from '@/components/professionals';
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type { Professional, CreateProfessionalPayload, UpdateProfessionalPayload } from '@/types';
import { professionalsService } from '@/services/professionals';

export function Professionals() {
  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [deletingProfessional, setDeletingProfessional] = useState<Professional | null>(null);
  const [vacationProfessional, setVacationProfessional] = useState<Professional | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: professionals, isLoading, isError, error } = useProfessionals(
    undefined,
    tab === 'active' ? 'true' : 'false',
  );

  const filteredProfessionals = useMemo(() => {
    if (!professionals || !searchTerm) return professionals || [];
    const term = searchTerm.toLowerCase();
    return professionals.filter((p) =>
      p.name.toLowerCase().includes(term)
    );
  }, [professionals, searchTerm]);
  const queryClient = useQueryClient();
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
      if (tab === 'inactive') {
        await professionalsService.permanentDelete(deletingProfessional.id);
        queryClient.invalidateQueries({ queryKey: ['professionals'] });
        setDeletingProfessional(null);
        toast.success('Profissional excluído', 'Profissional excluído permanentemente.');
      } else {
        await deleteProfessional.mutateAsync(deletingProfessional.id);
        setDeletingProfessional(null);
        toast.success('Profissional desativado', 'O profissional foi desativado com sucesso.');
      }
    } catch {
      toast.error('Erro', 'Não foi possível excluir o profissional.');
    }
  };

  const handleResetPassword = async (professional: Professional) => {
    if (!confirm(`Tem certeza que deseja resetar a senha de ${professional.name}? O profissional precisará criar uma nova senha no próximo login.`)) {
      return;
    }
    try {
      await professionalsService.resetPassword(professional.id);
      toast.success('Senha resetada', `${professional.name} precisará criar uma nova senha no próximo login.`);
    } catch {
      toast.error('Erro', 'Não foi possível resetar a senha do profissional.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <UserCog className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Profissionais</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie os profissionais da barbearia
            </p>
          </div>
        </div>

        {tab === 'active' && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            <Plus className="h-5 w-5" />
            Novo Profissional
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1 w-fit">
        <button onClick={() => setTab('active')} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'active' ? 'bg-[#8B6914] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
          Ativos
        </button>
        <button onClick={() => setTab('inactive')} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'inactive' ? 'bg-[#8B6914] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
          Inativos
        </button>
      </div>

      {/* Busca */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
          />
        </div>
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
      ) : tab === 'inactive' && (!filteredProfessionals || filteredProfessionals.length === 0) ? (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
          <UserCog className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-50" />
          <h3 className="mt-4 text-lg font-medium text-[var(--text-primary)]">Nenhum registro inativo</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Não há profissionais inativos no momento.</p>
        </div>
      ) : (
        <ProfessionalsTable
          professionals={filteredProfessionals}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingProfessional}
          onResetPassword={tab === 'active' ? handleResetPassword : undefined}
          onManageVacations={tab === 'active' ? setVacationProfessional : undefined}
          isLoading={deleteProfessional.isPending}
          onNewProfessional={tab === 'active' ? handleOpenCreateModal : undefined}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Novo Profissional"
        size="lg"
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
        size="lg"
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

      {/* Modal de gerenciamento de férias */}
      <Modal
        isOpen={!!vacationProfessional}
        onClose={() => {
          setVacationProfessional(null);
          // Atualiza a tabela (badge "em férias", currentVacation) após fechar.
          queryClient.invalidateQueries({ queryKey: ['professionals'] });
        }}
        title={vacationProfessional ? `Férias — ${vacationProfessional.name}` : 'Férias'}
        size="md"
      >
        {vacationProfessional && (
          <VacationsManager
            professionalId={vacationProfessional.id}
            professionalName={vacationProfessional.name}
          />
        )}
      </Modal>
    </div>
  );
}
