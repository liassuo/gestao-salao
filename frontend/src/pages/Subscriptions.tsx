import { useState } from 'react';
import { CreditCard, AlertCircle, Plus, Users } from 'lucide-react';
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
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type {
  SubscriptionPlan,
  ClientSubscription,
  CreatePlanPayload,
  UpdatePlanPayload,
  SubscribeClientPayload,
} from '@/types';

type Tab = 'plans' | 'subscriptions';

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
  const toast = useToast();

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
      await subscribeClient.mutateAsync(payload);
      handleCloseSubscribeModal();
      toast.success('Assinatura criada', 'O cliente foi assinado no plano com sucesso.');
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
            <ClientSubscriptionTable
              subscriptions={subscriptions || []}
              onCancel={setCancelingSubscription}
              onUseCut={handleUseCut}
              onResetCuts={handleResetCuts}
              isLoading={cancelSubscription.isPending || useCut.isPending || resetCuts.isPending}
              onNewSubscription={handleOpenSubscribeModal}
            />
          )}
        </>
      )}

      {/* Modal de criação de plano */}
      <Modal
        isOpen={isCreatePlanModalOpen}
        onClose={handleCloseCreatePlanModal}
        title="Novo Plano"
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
    </div>
  );
}
