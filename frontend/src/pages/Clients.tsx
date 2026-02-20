import { useState } from 'react';
import { Users, AlertCircle, Plus, Search } from 'lucide-react';
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getApiErrorMessage,
} from '@/hooks';
import { ClientsTable, ClientForm, ConfirmDeleteModal } from '@/components/clients';
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type { Client, ClientFilters, CreateClientPayload, UpdateClientPayload } from '@/types';

export function Clients() {
  const [filters, setFilters] = useState<ClientFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: clients, isLoading, isError, error } = useClients(filters);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const toast = useToast();

  // Filtro local por busca
  const filteredClients = clients?.filter((client) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(term) ||
      client.phone.includes(term) ||
      client.email?.toLowerCase().includes(term)
    );
  });

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (client: Client) => {
    setFormError(null);
    setEditingClient(client);
  };

  const handleCloseEditModal = () => {
    setEditingClient(null);
    setFormError(null);
  };

  const handleCreateClient = async (payload: CreateClientPayload) => {
    setFormError(null);
    try {
      await createClient.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Cliente cadastrado', 'O cliente foi cadastrado com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateClient = async (payload: UpdateClientPayload) => {
    if (!editingClient) return;
    setFormError(null);
    try {
      await updateClient.mutateAsync({ id: editingClient.id, payload });
      handleCloseEditModal();
      toast.success('Cliente atualizado', 'Os dados do cliente foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    try {
      await deleteClient.mutateAsync(deletingClient.id);
      setDeletingClient(null);
      toast.success('Cliente excluído', 'O cliente foi desativado com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir o cliente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <Users className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clientes</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie os clientes da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Novo Cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
          />
        </div>

        <select
          value={filters.hasDebts === undefined ? '' : String(filters.hasDebts)}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              hasDebts: e.target.value === '' ? undefined : e.target.value === 'true',
            }))
          }
          className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
        >
          <option value="">Todos os status</option>
          <option value="true">Com dívida</option>
          <option value="false">Sem dívida</option>
        </select>
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
        <ClientsTable
          clients={filteredClients || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingClient}
          isLoading={deleteClient.isPending}
          onNewClient={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Novo Cliente"
      >
        <ClientForm
          onSubmit={handleCreateClient}
          isLoading={createClient.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingClient}
        onClose={handleCloseEditModal}
        title="Editar Cliente"
      >
        <ClientForm
          client={editingClient}
          onSubmit={handleUpdateClient as (payload: CreateClientPayload) => Promise<void>}
          isLoading={updateClient.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmDeleteModal
        isOpen={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleDeleteClient}
        client={deletingClient}
        isLoading={deleteClient.isPending}
      />
    </div>
  );
}
