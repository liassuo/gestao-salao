import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Users, AlertCircle, Plus, Search } from 'lucide-react';
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getApiErrorMessage,
} from '@/hooks';
import { ClientsTable, ClientForm, ConfirmDeleteModal, ResetPasswordResultModal, GrantSubscriptionModal } from '@/components/clients';
import { ConfirmModal, Modal, SkeletonTable, useToast } from '@/components/ui';
import type { Client, ClientFilters, CreateClientPayload, UpdateClientPayload } from '@/types';
import { clientsService, type ResetClientPasswordResponse } from '@/services/clients';
import { useAuth, isAdmin } from '@/auth';

export function Clients() {
  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [filters, setFilters] = useState<ClientFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Cliente a confirmar reset (modal de confirmacao). null = modal fechado.
  const [confirmingResetClient, setConfirmingResetClient] = useState<Client | null>(null);
  // Estado de loading do reset — trava o botao "Resetar" enquanto a request roda.
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  // Resultado do reset de senha (modal mostra senha + botoes copiar/WhatsApp).
  // null = modal fechado. So existe no estado entre o reset e o usuario fechar.
  const [resetResult, setResetResult] = useState<ResetClientPasswordResponse | null>(null);
  // Cliente alvo do modal "Conceder assinatura" (cortesia). null = fechado.
  const [grantingClient, setGrantingClient] = useState<Client | null>(null);

  const { user } = useAuth();
  const userIsAdmin = isAdmin(user);

  const queryFilters: ClientFilters = {
    ...filters,
    isActive: tab === 'active' ? true : false,
  };
  const { data: clients, isLoading, isError, error } = useClients(queryFilters);
  const queryClient = useQueryClient();
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

  // 1ª etapa: clique em "Resetar senha" → abre o ConfirmModal abaixo.
  const handleResetPassword = (client: Client) => {
    setConfirmingResetClient(client);
  };

  // 2ª etapa: usuario clicou "Resetar" no ConfirmModal → faz a chamada e abre
  // o modal de resultado com a senha em texto puro (so retorna UMA vez).
  const handleConfirmResetPassword = async () => {
    if (!confirmingResetClient) return;
    const client = confirmingResetClient;
    setIsResettingPassword(true);
    try {
      const result = await clientsService.resetPassword(client.id);
      // Checagem defensiva: se por qualquer motivo o backend antigo (sem o
      // novo retorno) ainda estiver rodando, o tempPassword vem undefined.
      // Melhor falhar alto do que abrir o modal com senha vazia.
      if (!result?.tempPassword) {
        toast.error(
          'Erro',
          'Senha foi resetada mas o servidor nao retornou a senha temporaria. Reinicie o backend e tente novamente.',
        );
        setConfirmingResetClient(null);
        return;
      }
      setConfirmingResetClient(null);
      setResetResult(result);
    } catch {
      toast.error('Erro', 'Não foi possível resetar a senha do cliente.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleReactivateClient = async (client: Client) => {
    try {
      await updateClient.mutateAsync({ id: client.id, payload: { isActive: true } });
      toast.success('Cliente reativado', `${client.name} foi reativado e voltou para a lista de ativos.`);
    } catch {
      toast.error('Erro', 'Não foi possível reativar o cliente.');
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    try {
      if (tab === 'inactive') {
        await clientsService.permanentDelete(deletingClient.id);
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        setDeletingClient(null);
        toast.success('Cliente excluído', 'Cliente excluído permanentemente.');
      } else {
        await deleteClient.mutateAsync(deletingClient.id);
        setDeletingClient(null);
        toast.success('Cliente desativado', 'O cliente foi desativado com sucesso.');
      }
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

        {tab === 'active' && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            <Plus className="h-5 w-5" />
            Novo Cliente
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
      ) : tab === 'inactive' && (!filteredClients || filteredClients.length === 0) ? (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-50" />
          <h3 className="mt-4 text-lg font-medium text-[var(--text-primary)]">Nenhum registro inativo</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Não há clientes inativos no momento.</p>
        </div>
      ) : (
        <ClientsTable
          clients={filteredClients || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingClient}
          onResetPassword={tab === 'active' ? handleResetPassword : undefined}
          onReactivate={tab === 'inactive' ? handleReactivateClient : undefined}
          onGrantSubscription={userIsAdmin && tab === 'active' ? setGrantingClient : undefined}
          isLoading={deleteClient.isPending}
          onNewClient={tab === 'active' ? handleOpenCreateModal : undefined}
          mode={tab}
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
        mode={tab}
      />

      {/* Confirmacao do reset de senha — substitui o window.confirm() que
          era bloqueante e perdia foco quando o usuario clicava OK rapido. */}
      <ConfirmModal
        isOpen={!!confirmingResetClient}
        onClose={() => !isResettingPassword && setConfirmingResetClient(null)}
        onConfirm={handleConfirmResetPassword}
        title="Resetar senha"
        message={
          confirmingResetClient
            ? `Tem certeza que deseja resetar a senha de ${confirmingResetClient.name}? Uma nova senha temporaria sera gerada e voce podera encaminha-la para o cliente.`
            : ''
        }
        confirmLabel={isResettingPassword ? 'Resetando...' : 'Resetar senha'}
        variant="warning"
        isLoading={isResettingPassword}
      />

      {/* Resultado do reset de senha — mostra a senha temporaria e botoes
          de copiar / enviar pelo WhatsApp pro admin encaminhar ao cliente. */}
      <ResetPasswordResultModal
        isOpen={!!resetResult}
        onClose={() => setResetResult(null)}
        clientName={resetResult?.clientName ?? ''}
        clientPhone={resetResult?.clientPhone ?? null}
        tempPassword={resetResult?.tempPassword ?? ''}
      />

      {/* Conceder assinatura cortesia (admin) */}
      <GrantSubscriptionModal
        isOpen={!!grantingClient}
        client={grantingClient}
        onClose={() => setGrantingClient(null)}
        onGranted={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />
    </div>
  );
}
