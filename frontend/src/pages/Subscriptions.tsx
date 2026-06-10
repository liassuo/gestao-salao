import { useState, useMemo } from 'react';
import { CreditCard, AlertCircle, Plus, Users, Search, X, RefreshCw } from 'lucide-react';
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
  useRenewViaAsaas,
  useChargeCurrentCycle,
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
  ReconcileAsaasModal,
  RenewLinkModal,
} from '@/components/subscriptions';
import { Modal, SkeletonTable, useToast, PixPaymentModal, ConfirmModal } from '@/components/ui';
import type {
  SubscriptionPlan,
  ClientSubscription,
  CreatePlanPayload,
  UpdatePlanPayload,
  SubscribeClientPayload,
} from '@/types';

type Tab = 'plans' | 'subscriptions';
type StatusFilter = 'ACTIVE' | 'PENDING_CYCLE' | 'PENDING_PAYMENT' | 'ENDED' | 'CANCELED' | 'ALL';

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  ACTIVE: 'Ativas',
  PENDING_CYCLE: 'Ciclo não pago',
  PENDING_PAYMENT: 'Aguardando',
  ENDED: 'Encerradas',
  CANCELED: 'Canceladas',
  ALL: 'Todas',
};

// "Ciclo não pago": ACTIVE, não inadimplente, cujo ciclo vigente não foi pago
// (currentCyclePaid===false). É um recorte derivado, não um status — por isso
// recebe a assinatura inteira, não só o status.
// "Encerradas" = suspensas/expiradas (pode renovar). "Canceladas" = canceladas de
// vez — aba separada para o admin distinguir quem saiu de quem só venceu.
function matchesStatusFilter(sub: ClientSubscription, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ENDED')
    return sub.status === 'EXPIRED' || sub.status === 'SUSPENDED';
  if (filter === 'CANCELED') return sub.status === 'CANCELED';
  if (filter === 'PENDING_CYCLE')
    return sub.status === 'ACTIVE' && !sub.inadimplente && sub.currentCyclePaid === false;
  return sub.status === filter;
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
  const [confirmMethod, setConfirmMethod] = useState<'CASH' | 'PIX' | 'CARD'>('CASH');
  const [deletingSubscription, setDeletingSubscription] = useState<ClientSubscription | null>(null);
  // Renovação via link Asaas: ao clicar, o backend gera o invoiceUrl e abrimos um
  // modal com o link + botão WhatsApp. A assinatura só ativa quando o cliente paga.
  const [renewLinkData, setRenewLinkData] = useState<{
    invoiceUrl: string;
    clientName: string;
    clientPhone: string | null;
    planName: string;
  } | null>(null);

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
  const renewViaAsaas = useRenewViaAsaas();
  const chargeCurrentCycle = useChargeCurrentCycle();
  const deleteSubscription = useDeleteSubscription();
  const toast = useToast();

  // Filtered list + counts per filter
  const allSubscriptions = subscriptions || [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSubscriptions = useMemo(() => {
    return allSubscriptions.filter((s) => {
      if (!matchesStatusFilter(s, statusFilter)) return false;
      if (!normalizedQuery) return true;
      const name = (s.client?.name || '').toLowerCase();
      const phone = (s.client?.phone || '').toLowerCase();
      const planName = (s.plan?.name || '').toLowerCase();
      return name.includes(normalizedQuery) || phone.includes(normalizedQuery) || planName.includes(normalizedQuery);
    });
  }, [allSubscriptions, statusFilter, normalizedQuery]);
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { ACTIVE: 0, PENDING_CYCLE: 0, PENDING_PAYMENT: 0, ENDED: 0, CANCELED: 0, ALL: allSubscriptions.length };
    for (const s of allSubscriptions) {
      if (s.status === 'ACTIVE') {
        counts.ACTIVE++;
        // Recorte aditivo: "Ciclo não pago" é um subconjunto das Ativas.
        if (!s.inadimplente && s.currentCyclePaid === false) counts.PENDING_CYCLE++;
      } else if (s.status === 'PENDING_PAYMENT') counts.PENDING_PAYMENT++;
      else if (s.status === 'CANCELED') counts.CANCELED++;
      else if (s.status === 'EXPIRED' || s.status === 'SUSPENDED') counts.ENDED++;
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

  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);

  const handleCloseSubscribeModal = () => {
    setIsSubscribeModalOpen(false);
    setSubscribeError(null);
  };

  const handleSubscribe = async (payload: SubscribeClientPayload) => {
    setSubscribeError(null);
    try {
      await subscribeClient.mutateAsync(payload);
      handleCloseSubscribeModal();
      // Pagamento recebido no balcão → assinatura já ativa e valor no caixa de hoje.
      toast.success('Assinatura criada', 'Assinatura ativada e pagamento registrado no caixa de hoje.');
    } catch (err) {
      setSubscribeError(getApiErrorMessage(err));
    }
  };

  const handleCancelSubscription = async (immediate: boolean) => {
    if (!cancelingSubscription) return;
    try {
      await cancelSubscription.mutateAsync({ id: cancelingSubscription.id, immediate });
      setCancelingSubscription(null);
      if (immediate) {
        toast.success('Acesso revogado', 'A assinatura foi cancelada e o acesso revogado imediatamente.');
      } else {
        const dt = cancelingSubscription.endDate
          ? new Date(cancelingSubscription.endDate).toLocaleDateString('pt-BR')
          : 'o vencimento';
        toast.success('Assinatura cancelada', `O cliente mantém acesso até ${dt}. Sem cobrança no próximo ciclo.`);
      }
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
      await confirmPayment.mutateAsync({ id: confirmingPayment.id, method: confirmMethod });
      const name = confirmingPayment.client?.name || 'cliente';
      setConfirmingPayment(null);
      setConfirmMethod('CASH');
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

  // Renovar via Asaas: gera o link de pagamento (PIX ou cartão) e abre o modal
  // pro admin mandar pelo WhatsApp. Não ativa nem lança no caixa — só o webhook
  // ativa quando o cliente paga.
  const handleRenewViaAsaas = async (sub: ClientSubscription) => {
    try {
      const result = await renewViaAsaas.mutateAsync(sub.id);
      if (!result.invoiceUrl) {
        toast.error('Erro', 'Não foi possível gerar o link de pagamento. Tente novamente.');
        return;
      }
      setRenewLinkData({
        invoiceUrl: result.invoiceUrl,
        clientName: result.client?.name || sub.client?.name || 'cliente',
        clientPhone: result.client?.phone || sub.client?.phone || null,
        planName: result.planName || sub.plan?.name || 'Plano',
      });
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  // Gerar cobrança do ciclo atual (assinatura ATIVA com ciclo não pago): mesmo
  // fluxo de link Asaas, mas sem renovar o ciclo. Reusa o RenewLinkModal porque
  // o backend devolve o mesmo shape { invoiceUrl, client, planName }.
  const handleChargeCurrentCycle = async (sub: ClientSubscription) => {
    try {
      const result = await chargeCurrentCycle.mutateAsync(sub.id);
      if (!result.invoiceUrl) {
        toast.error('Erro', 'Não foi possível gerar o link de pagamento. Tente novamente.');
        return;
      }
      setRenewLinkData({
        invoiceUrl: result.invoiceUrl,
        clientName: result.client?.name || sub.client?.name || 'cliente',
        clientPhone: result.client?.phone || sub.client?.phone || null,
        planName: result.planName || sub.plan?.name || 'Plano',
      });
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReconcileModalOpen(true)}
              title="Lista cobrancas Asaas confirmadas que nao bateram com o sistema. Voce revisa e decide caso a caso."
              className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)]"
            >
              <RefreshCw className="h-4 w-4" />
              Reconciliar com Asaas
            </button>
            <button
              onClick={handleOpenSubscribeModal}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
            >
              <Plus className="h-5 w-5" />
              Nova Assinatura
            </button>
          </div>
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
            <SkeletonTable rows={5} cols={7} />
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
                  {(['ACTIVE', 'PENDING_CYCLE', 'PENDING_PAYMENT', 'ENDED', 'CANCELED', 'ALL'] as StatusFilter[]).map((filter) => {
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
                onReactivate={handleRenewViaAsaas}
                onChargeCycle={handleChargeCurrentCycle}
                isLoading={
                  cancelSubscription.isPending ||
                  useCut.isPending ||
                  resetCuts.isPending ||
                  reopenPix.isPending ||
                  confirmPayment.isPending ||
                  chargeCurrentCycle.isPending ||
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

      {/* Modal de reconciliacao com Asaas */}
      <ReconcileAsaasModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
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
              // PIX expirou e nunca foi pago — cancelamento imediato faz sentido aqui
              // (nao tem "ate endDate" pra manter; cliente nunca chegou a pagar).
              await cancelSubscription.mutateAsync({ id: pixModalData.subscriptionId, immediate: true });
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
        onClose={() => {
          setConfirmingPayment(null);
          setConfirmMethod('CASH');
        }}
        onConfirm={handleConfirmPayment}
        title="Confirmar pagamento manual"
        message={
          confirmingPayment
            ? `Marcar a assinatura de ${confirmingPayment.client?.name || 'cliente'} como ATIVA. Use quando o cliente já tiver pago no balcão. O pagamento é registrado no caixa e a ação zera os cortes do mês e renova a validade.`
            : ''
        }
        confirmLabel="Confirmar pagamento"
        variant="info"
        isLoading={confirmPayment.isPending}
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Como foi pago?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'CASH', label: 'Dinheiro' },
              { value: 'PIX', label: 'PIX' },
              { value: 'CARD', label: 'Cartão' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={confirmPayment.isPending}
                onClick={() => setConfirmMethod(opt.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  confirmMethod === opt.value
                    ? 'border-[#8B6914] bg-[#C8923A]/20 text-[var(--text-primary)]'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </ConfirmModal>

      {/* Renovação via link Asaas: link gerado pro cliente pagar (PIX ou cartão). */}
      <RenewLinkModal
        isOpen={!!renewLinkData}
        onClose={() => setRenewLinkData(null)}
        clientName={renewLinkData?.clientName || 'cliente'}
        clientPhone={renewLinkData?.clientPhone || null}
        planName={renewLinkData?.planName || 'Plano'}
        renewUrl={renewLinkData?.invoiceUrl || ''}
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
