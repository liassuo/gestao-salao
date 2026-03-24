import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLIENT_PATHS } from '../utils/paths';
import { clientApi } from '../services/api';
import { LoadingState, PixPaymentModal, CreditCardModal } from '../components/ui';
import { formatPrice } from '../utils/format';

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  cutsPerMonth: number;
  isActive: boolean;
}

interface ClientSubscription {
  id: string;
  status: string;
  cutsUsedThisMonth: number;
  startDate: string;
  plan: SubscriptionPlan;
}

interface PixData {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

interface CreditCardFormData {
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    phone: string;
    mobilePhone?: string;
  };
}

export function ClientPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mySubscription, setMySubscription] = useState<ClientSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pixModal, setPixModal] = useState<PixData | null>(null);
  const [paymentMethodModal, setPaymentMethodModal] = useState<string | null>(null); // planId ou 'REACTIVATE'
  const [creditCardModal, setCreditCardModal] = useState<{ planId?: string; isReactivating: boolean; amount: number } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        clientApi.get<SubscriptionPlan[]>('/subscriptions/plans'),
        clientApi.get<ClientSubscription | null>('/subscriptions/me').catch(() => ({ data: null })),
      ]);
      setPlans(plansRes.data);
      setMySubscription(subRes.data);

      // Se a assinatura está pendente de pagamento, tenta buscar o PIX
      if (subRes.data?.status === 'PENDING_PAYMENT') {
        clientApi.get<PixData | null>('/subscriptions/me/pending-pix')
          .then(res => {
            if (res.data) setPixModal(res.data);
          })
          .catch(e => console.warn('Erro ao buscar PIX pendente:', e));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubscribe = async (planId: string, billingType: string = 'PIX', cardData?: CreditCardFormData) => {
    setSubscribingId(planId);
    setPaymentMethodModal(null);
    setCreditCardModal(null);
    try {
      const payload: {
        planId: string;
        billingType: string;
        creditCard?: CreditCardFormData['creditCard'];
        creditCardHolderInfo?: CreditCardFormData['creditCardHolderInfo'];
        remoteIp?: string;
      } = { planId, billingType };
      if (cardData) {
        payload.creditCard = cardData.creditCard;
        payload.creditCardHolderInfo = cardData.creditCardHolderInfo;
        payload.remoteIp = '127.0.0.1'; // Idealmente pegar do cliente, mas Asaas aceita o do server se necessário ou qualquer IP válido para sandbox
      }

      const res = await clientApi.post<{
        subscription: ClientSubscription;
        pixData: PixData | null;
        invoiceUrl?: string | null;
      }>('/subscriptions/me/subscribe', payload);
      
      setMySubscription(res.data.subscription);
      
      if (res.data.pixData) {
        setPixModal(res.data.pixData);
      } else if (billingType === 'CREDIT_CARD') {
        alert('Assinatura com cartão processada com sucesso!');
      } else if (res.data.invoiceUrl) {
        window.open(res.data.invoiceUrl, '_blank', 'noopener,noreferrer');
        alert('Abra a nova aba para concluir o pagamento.');
      }
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'Erro ao assinar plano. Tente novamente.');
    } finally {
      setSubscribingId(null);
    }
  };

  const handleCancelConfirmed = async () => {
    setIsCancelling(true);
    try {
      await clientApi.post('/subscriptions/me/cancel');
      setMySubscription(null);
      setShowCancelConfirm(false);
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'Erro ao cancelar assinatura.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivate = async (billingType: string = 'PIX', cardData?: CreditCardFormData) => {
    setIsReactivating(true);
    setPaymentMethodModal(null);
    setCreditCardModal(null);
    try {
      const payload: {
        billingType: string;
        creditCard?: CreditCardFormData['creditCard'];
        creditCardHolderInfo?: CreditCardFormData['creditCardHolderInfo'];
        remoteIp?: string;
      } = { billingType };
      if (cardData) {
        payload.creditCard = cardData.creditCard;
        payload.creditCardHolderInfo = cardData.creditCardHolderInfo;
        payload.remoteIp = '127.0.0.1';
      }

      const res = await clientApi.post<{
        subscription: ClientSubscription;
        pixData: PixData | null;
        invoiceUrl?: string | null;
      }>('/subscriptions/me/reactivate', payload);
      
      setMySubscription(res.data.subscription);
      
      if (res.data.pixData) {
        setPixModal(res.data.pixData);
      } else if (billingType === 'CREDIT_CARD') {
        alert('Assinatura reativada com cartão!');
      } else if (res.data.invoiceUrl) {
        window.open(res.data.invoiceUrl, '_blank', 'noopener,noreferrer');
        alert('Abra a nova aba para pagar com cartão.');
      }
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || 'Erro ao reativar assinatura. Tente novamente.');
    } finally {
      setIsReactivating(false);
    }
  };

  const remainingCuts = mySubscription
    ? mySubscription.plan?.cutsPerMonth === 99
      ? 99
      : Math.max((mySubscription.plan?.cutsPerMonth || 0) - mySubscription.cutsUsedThisMonth, 0)
    : 0;

  if (isLoading) {
    return <LoadingState fullScreen message="Carregando planos..." />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="sticky top-0 bg-[var(--bg-primary)] z-10 px-5 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(CLIENT_PATHS.home)}
          className="p-2 -ml-2"
        >
          <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Planos</h1>
      </div>

      <div className="px-5 pb-10 space-y-6">
        {/* Assinatura Ativa */}
        {mySubscription && mySubscription.status === 'ACTIVE' && (
          <div className="bg-gradient-to-br from-[#8B6914] to-[#C8923A] rounded-2xl p-5 text-white">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Plano ativo</p>
                <h2 className="text-xl font-bold mt-0.5">{mySubscription.plan?.name}</h2>
              </div>
              <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {formatPrice(mySubscription.plan?.price || 0)}/mês
              </span>
            </div>

            {/* Contador de cortes */}
            <div className="bg-white/10 rounded-xl p-4 mt-3">
              <p className="text-xs opacity-80 mb-1">Créditos este mês</p>
              {mySubscription.plan?.cutsPerMonth === 99 ? (
                <p className="text-2xl font-bold">Ilimitado</p>
              ) : (
                <>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold">{remainingCuts}</span>
                    <span className="text-base opacity-70 mb-0.5">
                      / {mySubscription.plan?.cutsPerMonth || 0} restantes
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all"
                      style={{
                        width: `${Math.round((remainingCuts / (mySubscription.plan?.cutsPerMonth || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs opacity-70 mt-1.5">
                    Resetam com o próximo pagamento
                  </p>
                </>
              )}
            </div>

            {showCancelConfirm ? (
              <div className="mt-4 rounded-xl bg-white/10 p-4">
                <p className="text-sm text-white/90 mb-3">
                  Cancelar a assinatura? Você perderá acesso aos créditos do mês.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isCancelling}
                    className="flex-1 py-2 rounded-xl bg-white/20 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Não
                  </button>
                  <button
                    onClick={handleCancelConfirmed}
                    disabled={isCancelling}
                    className="flex-1 py-2 rounded-xl bg-red-500/70 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="mt-4 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              >
                Cancelar assinatura
              </button>
            )}
          </div>
        )}

        {/* Assinatura Suspensa */}
        {mySubscription && mySubscription.status === 'SUSPENDED' && (
          <div className="bg-[var(--card-bg)] border border-red-500/30 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--text-primary)]">{mySubscription.plan?.name}</p>
                <p className="text-sm text-red-400 font-medium">Assinatura suspensa</p>
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {formatPrice(mySubscription.plan?.price || 0)}/mês
              </span>
            </div>

            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Sua assinatura foi suspensa por falta de pagamento. Reative para voltar a usar seus créditos mensais.
              </p>
            </div>

            <button
              onClick={() => setPaymentMethodModal('REACTIVATE')}
              disabled={isReactivating}
              className="w-full py-3 bg-[#8B6914] hover:bg-[#725510] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isReactivating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reativar assinatura
                </>
              )}
            </button>

            <button
              onClick={() => setShowCancelConfirm(true)}
              className="mt-2 w-full py-2 text-[var(--text-muted)] text-sm font-medium"
            >
              Cancelar definitivamente
            </button>

            {showCancelConfirm && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  Cancelar a assinatura definitivamente?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isCancelling}
                    className="flex-1 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] text-sm font-medium disabled:opacity-50"
                  >
                    Não
                  </button>
                  <button
                    onClick={handleCancelConfirmed}
                    disabled={isCancelling}
                    className="flex-1 py-2 rounded-xl bg-red-500/70 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assinatura Aguardando Pagamento */}
        {mySubscription && mySubscription.status === 'PENDING_PAYMENT' && (
          <div className="bg-[var(--card-bg)] border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{mySubscription.plan?.name}</p>
                <p className="text-sm text-amber-400 font-medium">Aguardando pagamento</p>
              </div>
              <span className="ml-auto text-sm font-bold text-[var(--text-primary)]">
                {formatPrice(mySubscription.plan?.price || 0)}/mês
              </span>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Sua assinatura foi criada, mas ainda não recebemos a confirmação do pagamento.
                Após o PIX ou o cartão serem confirmados pelo Asaas, seus créditos serão liberados automaticamente.
              </p>
            </div>

            {pixModal && (
              <button
                onClick={() => setPixModal(pixModal)}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium mb-3"
              >
                Ver QR Code PIX
              </button>
            )}

            {showCancelConfirm ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  Cancelar a assinatura pendente?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isCancelling}
                    className="flex-1 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] text-sm font-medium disabled:opacity-50"
                  >
                    Não
                  </button>
                  <button
                    onClick={handleCancelConfirmed}
                    disabled={isCancelling}
                    className="flex-1 py-2 rounded-xl bg-red-500/80 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] text-sm font-medium transition-colors hover:bg-[var(--hover-bg)]"
              >
                Cancelar assinatura
              </button>
            )}
          </div>
        )}

        {/* Lista de Planos */}
        {!mySubscription && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                Escolha seu plano
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Assine e economize nos seus agendamentos mensais
              </p>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-10 text-[var(--text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="font-medium">Nenhum plano disponível</p>
                <p className="text-sm mt-1">Em breve teremos opções para você</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-sm text-[var(--text-muted)] mt-0.5">{plan.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#C8923A]">{formatPrice(plan.price)}</p>
                        <p className="text-xs text-[var(--text-muted)]">por mês</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-4 h-4 text-[#C8923A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                      </svg>
                      <span className="text-sm text-[var(--text-primary)]">
                        {plan.cutsPerMonth === 99
                          ? 'Cortes ilimitados por mês'
                          : `${plan.cutsPerMonth} corte${plan.cutsPerMonth > 1 ? 's' : ''} por mês`}
                      </span>
                    </div>

                    <button
                      onClick={() => setPaymentMethodModal(plan.id)}
                      disabled={subscribingId === plan.id}
                      className="w-full py-3 bg-[#8B6914] hover:bg-[#725510] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {subscribingId === plan.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      ) : (
                        'Assinar agora'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Plano atual + upgrade/info */}
        {mySubscription && mySubscription.status === 'ACTIVE' && plans.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">Planos disponíveis</h2>
            <div className="space-y-3">
              {plans.map((plan) => {
                const isCurrent = plan.id === mySubscription.plan?.id;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl p-4 border flex items-center justify-between ${
                      isCurrent
                        ? 'border-[#C8923A] bg-[#C8923A]/10'
                        : 'border-[var(--card-border)] bg-[var(--card-bg)]'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{plan.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {plan.cutsPerMonth === 99 ? 'Ilimitado' : `${plan.cutsPerMonth} cortes/mês`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#C8923A]">{formatPrice(plan.price)}/mês</p>
                      {isCurrent && (
                        <span className="text-xs text-[#C8923A] font-semibold">Atual</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modais de Pagamento */}
      <PixPaymentModal
        isOpen={!!pixModal}
        onClose={() => setPixModal(null)}
        pixData={pixModal}
        amount={mySubscription?.plan?.price || 0}
        description={`Plano ${mySubscription?.plan?.name || ''}`}
      />

      <CreditCardModal
        isOpen={!!creditCardModal}
        onClose={() => setCreditCardModal(null)}
        amount={creditCardModal?.amount || 0}
        isSubmitting={subscribingId !== null || isReactivating}
        onSubmit={(data) => {
          if (creditCardModal?.isReactivating) {
            handleReactivate('CREDIT_CARD', data);
          } else if (creditCardModal?.planId) {
            handleSubscribe(creditCardModal.planId, 'CREDIT_CARD', data);
          }
        }}
      />

      {/* Modal de Seleção de Método */}
      {paymentMethodModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-[var(--card-border)] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Forma de Pagamento</h3>
              <button
                onClick={() => setPaymentMethodModal(null)}
                className="p-1 text-[var(--text-muted)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-[var(--text-muted)] mb-5">
              Escolha como deseja pagar sua assinatura mensal:
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const id = paymentMethodModal;
                  if (id === 'REACTIVATE') {
                    handleReactivate('PIX');
                  } else {
                    handleSubscribe(id, 'PIX');
                  }
                }}
                className="w-full p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[#C8923A] transition-all flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#C8923A]/10 flex items-center justify-center text-[#C8923A] group-hover:bg-[#C8923A] group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h-2m-6 0H9m11-4V7a2 2 0 00-2-2h-3m-1 0H7a2 2 0 00-2 2v10a2 2 0 002 2h3" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-bold text-[var(--text-primary)]">PIX</p>
                  <p className="text-xs text-[var(--text-muted)]">Liberação imediata dos créditos</p>
                </div>
              </button>

              <button
                onClick={() => {
                  const id = paymentMethodModal;
                  if (id === 'REACTIVATE') {
                    setCreditCardModal({ isReactivating: true, amount: mySubscription?.plan?.price || 0 });
                  } else {
                    const plan = plans.find(p => p.id === id);
                    setCreditCardModal({ planId: id, isReactivating: false, amount: plan?.price || 0 });
                  }
                  setPaymentMethodModal(null);
                }}
                className="w-full p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[#C8923A] transition-all flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#C8923A]/10 flex items-center justify-center text-[#C8923A] group-hover:bg-[#C8923A] group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-bold text-[var(--text-primary)]">Cartão de Crédito</p>
                  <p className="text-xs text-[var(--text-muted)]">Cobrança automática mensal</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
