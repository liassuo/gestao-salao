import { useState, useMemo } from 'react';
import { Scissors, AlertCircle, Plus, Search } from 'lucide-react';
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  getApiErrorMessage,
} from '@/hooks';
import { ServicesTable, ServiceForm, ConfirmDeleteModal } from '@/components/services';
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type { Service, CreateServicePayload, UpdateServicePayload } from '@/types';

export function Services() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: services, isLoading, isError, error } = useServices();

  const filteredServices = useMemo(() => {
    if (!services || !searchTerm) return services || [];
    const term = searchTerm.toLowerCase();
    return services.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      s.description?.toLowerCase().includes(term)
    );
  }, [services, searchTerm]);
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (service: Service) => {
    setFormError(null);
    setEditingService(service);
  };

  const handleCloseEditModal = () => {
    setEditingService(null);
    setFormError(null);
  };

  const handleCreateService = async (payload: CreateServicePayload) => {
    setFormError(null);
    try {
      await createService.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Serviço cadastrado', 'O serviço foi cadastrado com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateService = async (payload: UpdateServicePayload) => {
    if (!editingService) return;
    setFormError(null);
    try {
      await updateService.mutateAsync({ id: editingService.id, payload });
      handleCloseEditModal();
      toast.success('Serviço atualizado', 'Os dados do serviço foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteService = async () => {
    if (!deletingService) return;
    try {
      await deleteService.mutateAsync(deletingService.id);
      setDeletingService(null);
      toast.success('Serviço excluído', 'O serviço foi desativado com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir o serviço.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
            <Scissors className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Serviços</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie os serviços oferecidos pela barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Novo Serviço
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
            placeholder="Buscar por nome ou descrição..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-500">Erro ao carregar</h3>
              <p className="text-sm text-red-400">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ServicesTable
          services={filteredServices}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingService}
          isLoading={deleteService.isPending}
          onNewService={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Novo Serviço"
      >
        <ServiceForm
          onSubmit={handleCreateService}
          isLoading={createService.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingService}
        onClose={handleCloseEditModal}
        title="Editar Serviço"
      >
        <ServiceForm
          service={editingService}
          onSubmit={handleUpdateService as (payload: CreateServicePayload) => Promise<void>}
          isLoading={updateService.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmDeleteModal
        isOpen={!!deletingService}
        onClose={() => setDeletingService(null)}
        onConfirm={handleDeleteService}
        service={deletingService}
        isLoading={deleteService.isPending}
      />
    </div>
  );
}
