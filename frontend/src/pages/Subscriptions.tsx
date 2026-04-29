import { useState, useMemo } from 'react';
import { CreditCard, AlertCircle, Plus, Users, Search, X } from 'lucide-react';
import {
  useSubscriptionPlans,
  useClientSubscriptions,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  useSubscribeClient,
  useCancelSubscription,
  useUseCut,
  useResetCuts,
  useReopenSubscriptionPix,
  useRegenerateSubscriptionPix,
  useConfirmSubscriptionPayment,
  useDeleteSubscription,
  useClients,
  getApiErrorMessage,
} from '@/hooks';
import {
  SubscriptionPlanTable,
  SubscriptionPlanForm,
  ClientSubscriptionTable,
  SubscribeClientModal,
  ConfirmCancelModal,
} from '@/components/subscriptions';
import { Modal, SkeletonTable, useToast, PixPaymentModal, ConfirmModal } from '@/components/ui';
import type {
  SubscriptionPlan,
  ClientSubscription,
  CreatePlanPayload,
  UpdatePlanPayload,
  SubscribeClientPayload,
  SubscriptionStatus,
} from '@/types';

type Tab = 'plans' | 'subscriptions';
type StatusFilter = 'ACTIVE' | 'PENDING_PAYMENT' | 'ENDED' | 'ALL';

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  ACTIVE: 'Ativas',
  PENDING_PAYMENT: 'Aguardando',
  ENDED: 'Encerradas',
  ALL: 'Todas',
};

function matchesStatusFilter(status: SubscriptionStatus, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ENDED') return status === 'CANCELED' || status === 'EXPIRED' || status === 'SUSPENDED';
  return status === filter;
}

export function Subscriptions() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');

  // Plans state
  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [planFormError, setPlanFormError] = useState<string | null>(null);

  // Subscriptions state
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState<ClientSubscription | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState<ClientSubscription | null>(null);
  const [deletingSubscription, setDeletingSubscription] = useState<ClientSubscription | null>(null);
  const [reactivatingSubscription, setReactivatingSubscription] = useState<ClientSubscription | null>(null);

  // Pix Payment state
  const [pixModalData, setPixModalData] = useState<{ pixData: any; amount: number; description?: string; subscriptionId?: string } | null>(null);

  // Hooks
  const { data: plans, isLoading: isLoadingPlans, isError: isPlansError, error: plansError } = useSubscriptionPlans(true);
  const { data: subscriptions, isLoading: isLoadingSubscriptions, isError: isSubscriptionsError, error: subscriptionsError } = useClientSubscriptions();
  const { data: clients } = useClients();

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const subscribeClient = useSubscribeClient();
  const cancelSubscription = useCancelSubscription();
  const useCut = useUseCut();
  const resetCuts = useResetCuts();
  const reopenPix = useReopenSubscriptionPix();
  const regeneratePix = useRegenerateSubscriptionPix();
  const confirmPayment = useConfirmSubscriptionPayment();
  const deleteSubscription = useDeleteSubscription();
  const toast = useToast();

  // Filtered list + counts per filter
  const allSubscriptions = subscriptions || [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSubscriptions = useMemo(() => {
    return allSubscriptions.filter((s) => {
      if (!matchesStatusFilter(s.status, statusFilter)) return false;
      if (!normalizedQuery) return true;
      const name = (s.client?.name || '').toLowerCase();
      const phone = (s.client?.phone || '').toLowerCase();
      const planName = (s.plan?.name || '').toLowerCase();
      return name.includes(normalizedQuery) || phone.includes(normalizedQuery) || planName.includes(normalizedQuery);
    });
  }, [allSubscriptions, statusFilter, normalizedQuery]);
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { ACTIVE: 0, PENDING_PAYMENT: 0, ENDED: 0, ALL: allSubscriptions.length };
    for (const s of allSubscriptions) {
      if (s.status === 'ACTIVE') counts.ACTIVE++;
      else if (s.status === 'PENDING_PAYMENT') counts.PENDING_PAYMENT++;
      else if (s.status === 'CANCELED' || s.status === 'EXPIRED' || s.status === 'SUSPENDED') counts.ENDED++;
    }
    return counts;
  }, [allSubscriptions]);

  // Plan handlers
  const handleOpenCreatePlanModal = () => {
    setPlanFormError(null);
    setIsCreatePlanModalOpen(true);
  };

  const handleCloseCreatePlanModal = () => {
    setIsCreatePlanModalOpen(false);
    setPlanFormError(null);
  };

  const handleOpenEditPlanModal = (plan: SubscriptionPlan) => {
    setPlanFormError(null);
    setEditingPlan(plan);
  };

  const handleCloseEditPlanModal = () => {
    setEditingPlan(null);
    setPlanFormError(null);
  };

  const handleCreatePlan = async (payload: CreatePlanPayload) => {
    setPlanFormError(null);
    try {
      await createPlan.mutateAsync(payload);
      handleCloseCreatePlanModal();
      toast.success('Plano cadastrado', 'O plano foi cadastrado com sucesso.');
    } catch (err) {
      setPlanFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdatePlan = async (payload: UpdatePlanPayload) => {
    if (!editingPlan) return;
    setPlanFormError(null);
    try {
      await updatePlan.mutateAsync({ id: editingPlan.id, payload });
      handleCloseEditPlanModal();
      toast.success('Plano atualizado', 'Os dados do plano foram atualizados.');
    } catch (err) {
      setPlanFormError(getApiErrorMessage(err));
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    try {
      await deletePlan.mutateAsync(deletingPlan.id);
      setDeletingPlan(null);
      toast.success('Plano desativado', 'O plano foi desativado com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  // Subscription handlers
  const handleOpenSubscribeModal = () => {
    setSubscribeError(null);
    setIsSubscribeModalOpen(true);
  };

  const handleCloseSubscribeModal = () => {
    setIsSubscribeModalOpen(false);
    setSubscribeError(null);
  };

  const handleSubscribe = async (payload: SubscribeClientPayload) => {
    setSubscribeError(null);
    try {
      const response = await subscribeClient.mutateAsync(payload) as any;
      handleCloseSubscribeModal();
      toast.success('Assinatura criada', 'O cliente foi assinado no plano com sucesso.');

      // Se houver dados de pagamento (PIX), abre o modal
      if (response?.pixData) {
        setPixModalData({
          pixData: response.pixData,
          amount: response.subscription?.plan?.price || 0,
          description: `Assinatura: ${response.subscription?.plan?.name}`,
          subscriptionId: response.subscription?.id,
        });
      }
    } catch (err) {
      setSubscribeError(getApiErrorMessage(err));
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelingSubscription) return;
    try {
      await cancelSubscription.mutateAsync(cancelingSubscription.id);
      setCancelingSubscription(null);
      toast.success('Assinatura cancelada', 'A assinatura foi cancelada com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleUseCut = async (subscription: ClientSubscription) => {
    try {
      await useCut.mutateAsync(subscription.id);
      toast.success('Corte registrado', `Corte registrado para ${subscription.client?.name || 'cliente'}.`);
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleResetCuts = async (subscription: ClientSubscription) => {
    try {
      await resetCuts.mutateAsync(subscription.id);
      toast.success('Cortes renovados', `Cortes de ${subscription.client?.name || 'cliente'} foram zerados (pagamento confirmado).`);
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleReopenPix = async (subscription: ClientSubscription) => {
    try {
      let pixData = await reopenPix.mutateAsync(subscription.id);

      // Se não há PIX recuperável, gera um novo automaticamente
      if (!pixData) {
        try {
          pixData = await regeneratePix.mutateAsync(subscription.id);
          toast.info('Novo PIX gerado', 'O PIX anterior expirou. Foi gerada uma nova cobrança.');
        } catch (regenErr) {
          toast.error('Erro', getApiErrorMessage(regenErr));
          return;
        }
      }

      setPixModalData({
        pixData,
        amount: subscription.plan?.price || 0,
        description: `Assinatura: ${subscription.plan?.name || 'Plano'}`,
        subscriptionId: subscription.id,
      });
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmingPayment) return;
    try {
      await confirmPayment.mutateAsync(confirmingPayment.id);
      const name = confirmingPayment.client?.name || 'cliente';
      setConfirmingPayment(null);
      toast.success('Pagamento confirmado', `Assinatura de ${name} ativada.`);
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleDeleteSubscription = async () => {
    if (!deletingSubscription) return;
    try {
      await deleteSubscription.mutateAsync(deletingSubscription.id);
      setDeletingSubscription(null);
      toast.success('Assinatura removida', 'O registro foi excluído do histórico.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleReactivate = async () => {
    if (!reactivatingSubscription) return;
    const sub = reactivatingSubscription;
    try {
      const response = await subscribeClient.mutateAsync({
        clientId: sub.client.id,
        planId: sub.plan.id,
      }) as any;
      setReactivatingSubscription(null);
      toast.success('Assinatura reativada', 'Uma nova cobrança foi gerada.');

      if (response?.pixData) {
        setPixModalData({
          pixData: response.pixData,
          amount: response.subscription?.plan?.price || sub.plan.price || 0,
          description: `Assinatura: ${response.subscription?.plan?.name || sub.plan.name}`,
          subscriptionId: response.subscription?.id,
        });
      }
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const tabs = [
    { id: 'plans' as Tab, label: 'Planos', icon: CreditCard },
    { id: 'subscriptions' as Tab, label: 'Assinaturas', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <CreditCard className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Assinaturas</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie planos e assinaturas de clientes
            </p>
          </div>
        </div>

        {activeTab === 'plans' ? (
          <button
            onClick={handleOpenCreatePlanModal}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            <Plus className="h-5 w-5" />
            Novo Plano
          </button>
        ) : (
          <button
            onClick={handleOpenSubscribeModal}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            <Plus className="h-5 w-5" />
            Nova Assinatura
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[var(--hover-bg)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'plans' && (
        <>
          {isLoadingPlans ? (
            <SkeletonTable rows={5} cols={6} />
          ) : isPlansError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-[#A63030]" />
                <div>
                  <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
                  <p className="text-sm text-[#C45050]">
                    {plansError instanceof Error ? plansError.message : 'Ocorreu um erro inesperado.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <SubscriptionPlanTable
              plans={plans || []}
              onEdit={handleOpenEditPlanModal}
              onDelete={setDeletingPlan}
              isLoading={deletePlan.isPending}
              onNewPlan={handleOpenCreatePlanModal}
            />
          )}
        </>
      )}

      {activeTab === 'subscriptions' && (
        <>
          {isLoadingSubscriptions ? (
            <SkeletonTable rows={5} cols={6} />
          ) : isSubscriptionsError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-[#A63030]" />
                <div>
                  <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
                  <p className="text-sm text-[#C45050]">
                    {subscriptionsError instanceof Error ? subscriptionsError.message : 'Ocorreu um erro inesperado.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Search + filter chips */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por cliente, telefone ou plano..."
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2.5 pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-2 focus:ring-[#C8923A]/30"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['ACTIVE', 'PENDING_PAYMENT', 'ENDED', 'ALL'] as StatusFilter[]).map((filter) => {
                    const isActive = statusFilter === filter;
                    return (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-[#8B6914] text-white'
                            : 'border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                        }`}
                      >
                        {STATUS_FILTER_LABEL[filter]}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isActive
                              ? 'bg-white/20'
                              : 'bg-[var(--hover-bg)] text-[var(--text-muted)]'
                          }`}
                        >
                          {statusCounts[filter]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <ClientSubscriptionTable
                subscriptions={filteredSubscriptions}
                onCancel={setCancelingSubscription}
                onUseCut={handleUseCut}
                onResetCuts={handleResetCuts}
                onReopenPix={handleReopenPix}
                onConfirmPayment={setConfirmingPayment}
                onDelete={setDeletingSubscription}
                onReactivate={setReactivatingSubscription}
                isLoading={
                  cancelSubscription.isPending ||
                  useCut.isPending ||
                  resetCuts.isPending ||
                  reopenPix.isPending ||
                  confirmPayment.isPending ||
                  deleteSubscription.isPending
                }
                onNewSubscription={handleOpenSubscribeModal}
              />
            </>
          )}
        </>
      )}

      {/* Modal de criação de plano */}
      <Modal
        isOpen={isCreatePlanModalOpen}
        onClose={handleCloseCreatePlanModal}
        title="Novo Plano"
        size="xl"
      >
        <SubscriptionPlanForm
          onSubmit={handleCreatePlan}
          isLoading={createPlan.isPending}
          error={planFormError}
        />
      </Modal>

      {/* Modal de edicao de plano */}
      <Modal
        isOpen={!!editingPlan}
        onClose={handleCloseEditPlanModal}
        title="Editar Plano"
        size="xl"
      >
        <SubscriptionPlanForm
          plan={editingPlan}
          onSubmit={handleUpdatePlan as (payload: CreatePlanPayload) => Promise<void>}
          isLoading={updatePlan.isPending}
          error={planFormError}
        />
      </Modal>

      {/* Modal de confirmação de desativação de plano */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingPlan(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Desativar Plano</h3>
            <p className="mb-6 text-[var(--text-secondary)]">
              Tem certeza que deseja desativar o plano <strong>{deletingPlan.name}</strong>?
              Clientes existentes não serão afetados.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingPlan(null)}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePlan}
                disabled={deletePlan.isPending}
                className="rounded-xl bg-[#8B2020] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B1818] disabled:opacity-50"
              >
                {deletePlan.isPending ? 'Desativando...' : 'Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de nova assinatura */}
      <SubscribeClientModal
        isOpen={isSubscribeModalOpen}
        onClose={handleCloseSubscribeModal}
        onSubmit={handleSubscribe}
        clients={clients || []}
        plans={plans || []}
        isLoading={subscribeClient.isPending}
        error={subscribeError}
      />

      {/* Modal de cancelamento de assinatura */}
      <ConfirmCancelModal
        isOpen={!!cancelingSubscription}
        onClose={() => setCancelingSubscription(null)}
        onConfirm={handleCancelSubscription}
        subscription={cancelingSubscription}
        isLoading={cancelSubscription.isPending}
      />

      {/* Modal do PIX */}
      <PixPaymentModal
        isOpen={!!pixModalData}
        onClose={() => setPixModalData(null)}
        onExpire={async () => {
          if (pixModalData?.subscriptionId) {
            try {
              await cancelSubscription.mutateAsync(pixModalData.subscriptionId);
              toast.warning('PIX expirado', 'O prazo de pagamento venceu e a assinatura foi cancelada automaticamente.');
            } catch {
              // silently ignore
            }
          }
        }}
        pixData={pixModalData?.pixData}
        amount={pixModalData?.amount ?? 0}
        description={pixModalData?.description}
      />

      {/* Confirmar pagamento manual */}
      <ConfirmModal
        isOpen={!!confirmingPayment}
        onClose={() => setConfirmingPayment(null)}
        onConfirm={handleConfirmPayment}
        title="Confirmar pagamento manual"
        message={
          confirmingPayment
            ? `Marcar a assinatura de ${confirmingPayment.client?.name || 'cliente'} como ATIVA sem confirmação do gateway? Use apenas se o cliente já tiver pago em dinheiro ou transferência. Esta ação zera os cortes do mês e renova a validade.`
            : ''
        }
        confirmLabel="Confirmar pagamento"
        variant="info"
        isLoading={confirmPayment.isPending}
      />

      {/* Reativar assinatura encerrada */}
      <ConfirmModal
        isOpen={!!reactivatingSubscription}
        onClose={() => setReactivatingSubscription(null)}
        onConfirm={handleReactivate}
        title="Reativar assinatura"
        message={
          reactivatingSubscription
            ? `Criar uma nova assinatura para ${reactivatingSubscription.client?.name || 'cliente'} no plano ${reactivatingSubscription.plan?.name || ''} (${(reactivatingSubscription.plan?.price ? (reactivatingSubscription.plan.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')})? Será gerado um novo PIX.`
            : ''
        }
        confirmLabel="Reativar"
        variant="info"
        isLoading={subscribeClient.isPending}
      />

      {/* Excluir do histórico */}
      <ConfirmModal
        isOpen={!!deletingSubscription}
        onClose={() => setDeletingSubscription(null)}
        onConfirm={handleDeleteSubscription}
        title="Excluir do histórico"
        message={
          deletingSubscription
            ? `Excluir definitivamente a assinatura de ${deletingSubscription.client?.name || 'cliente'} do histórico? Esta ação remove o registro do banco e perde rastro de auditoria. Não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteSubscription.isPending}
      />
    </div>
  );
}
