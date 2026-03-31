import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLIENT_PATHS } from '../utils/paths';
import { useClientServices, useClientProfessionals, useAvailableSlots, useClientAppointments } from '../hooks';
import { LoadingState, EmptyState } from '../components/ui';
import { formatPrice, formatDuration, formatDateISO, formatDateLong } from '../utils/format';
import { clientApi } from '../services/api';
import type { Service, Professional, TimeSlot, AppointmentBillingType } from '../types';

interface ActivePromotion {
  id: string;
  name: string;
  discountPercent: number;
  services: { id: string; name: string; price: number }[];
}

function getServiceDiscount(serviceId: string, promotions: ActivePromotion[]): number | null {
  for (const promo of promotions) {
    const match = promo.services.find((s) => s.id === serviceId);
    if (match) return promo.discountPercent;
  }
  return null;
}

function discountedPrice(price: number, discountPercent: number): number {
  return Math.round(price * (100 - discountPercent) / 100);
}

type Step = 'service' | 'schedule' | 'confirm';

const STEPS: Step[] = ['service', 'schedule', 'confirm'];
const STEP_TITLES: Record<Step, string> = {
  service: 'Escolha o serviço',
  schedule: 'Escolha data e horário',
  confirm: 'Confirmar agendamento',
};

function generateWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  // Start from Monday of the week
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function getMonthYearLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

function groupSlotsByPeriod(slots: TimeSlot[]) {
  const available = slots.filter((s) => s.available);
  const manha = available.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour < 12;
  });
  const tarde = available.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour >= 12 && hour < 18;
  });
  const noite = available.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour >= 18;
  });
  return { manha, tarde, noite };
}

interface MySubscription {
  id: string;
  status: string;
  cutsUsedThisMonth: number;
  plan: { id: string; name: string; price: number; cutsPerMonth: number };
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  cutsPerMonth: number;
}

interface PixData {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
}

export function ClientBooking() {
  const [currentStep, setCurrentStep] = useState<Step>('service');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySubscription, setMySubscription] = useState<MySubscription | null>(null);
  const [useSubscriptionCut, setUseSubscriptionCut] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [pixModal, setPixModal] = useState<PixData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixCountdown, setPixCountdown] = useState(600);
  const [pixEntityId, setPixEntityId] = useState<string | null>(null);
  const [pixEntityType, setPixEntityType] = useState<'appointment' | 'subscription' | null>(null);
  const [debtData, setDebtData] = useState<{ total: number; debts: any[] } | null>(null);
  const [debtPixData, setDebtPixData] = useState<PixData | null>(null);
  const [isPayingDebt, setIsPayingDebt] = useState(false);
  const [debtPixCopied, setDebtPixCopied] = useState(false);
  const [debtPollingActive, setDebtPollingActive] = useState(false);
  const [appointmentBillingType, setAppointmentBillingType] =
    useState<AppointmentBillingType>('PIX');
  const [subscribePlanModal, setSubscribePlanModal] = useState<string | null>(null);
  const [leaveAfterPixClose, setLeaveAfterPixClose] = useState(false);

  const navigate = useNavigate();
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);

  const { services, isLoading: servicesLoading, fetchServices } = useClientServices();
  const { professionals, isLoading: professionalsLoading, fetchAvailableProfessionals } = useClientProfessionals();
  const { slots, isLoading: slotsLoading, fetchSlots, clearSlots } = useAvailableSlots();
  const { createAppointment } = useClientAppointments();

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => generateWeekDates(baseDate), [baseDate]);

  useEffect(() => {
    clientApi.get<{ debts: any[]; total: number }>('/debts/my')
      .then((res) => {
        if (res.data.debts.length > 0) {
          setDebtData(res.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!debtPollingActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await clientApi.get<{ debts: any[]; total: number }>('/debts/my');
        if (res.data.debts.length === 0) {
          setDebtData(null);
          setDebtPixData(null);
          setDebtPollingActive(false);
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [debtPollingActive]);

  useEffect(() => {
    if (!pixModal) {
      setPixCountdown(600);
      return;
    }
    const entityId = pixEntityId;
    const entityType = pixEntityType;
    const shouldLeave = leaveAfterPixClose;
    setPixCountdown(600);

    const timer = setInterval(() => {
      setPixCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Cancelar o agendamento ou assinatura ao expirar
          (async () => {
            if (entityType === 'appointment' && entityId) {
              await clientApi.patch(`/appointments/${entityId}/cancel`).catch(() => {});
            } else if (entityType === 'subscription') {
              await clientApi.post('/subscriptions/me/cancel').catch(() => {});
            }
            setPixModal(null);
            setPixEntityId(null);
            setPixEntityType(null);
            if (shouldLeave) {
              navigate(CLIENT_PATHS.home);
            }
          })();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixModal]);

  useEffect(() => {
    fetchServices();
    clientApi.get<ActivePromotion[]>('/promotions/active')
      .then((res) => setActivePromotions(res.data))
      .catch(() => {});
    clientApi.get<MySubscription | null>('/subscriptions/me')
      .then((res) => {
        if (res.data && res.data.status === 'ACTIVE') {
          setMySubscription(res.data);
          const remaining = res.data.plan.cutsPerMonth === 99
            ? 99
            : Math.max(res.data.plan.cutsPerMonth - res.data.cutsUsedThisMonth, 0);
          setUseSubscriptionCut(remaining > 0);
        }
      })
      .catch(() => {});
    clientApi.get<SubscriptionPlan[]>('/subscriptions/plans')
      .then((res) => setPlans(res.data))
      .catch(() => {});
  }, [fetchServices]);

  const subscribeFromBooking = async (planId: string, billing: AppointmentBillingType) => {
    setSubscribingPlanId(planId);
    setSubscribePlanModal(null);
    try {
      const res = await clientApi.post<{
        subscription: MySubscription;
        pixData: PixData | null;
        invoiceUrl?: string | null;
      }>('/subscriptions/me/subscribe', { planId, billingType: billing });
      setMySubscription(res.data.subscription);
      const remaining = res.data.subscription.plan.cutsPerMonth === 99
        ? 99
        : Math.max(res.data.subscription.plan.cutsPerMonth - res.data.subscription.cutsUsedThisMonth, 0);
      setUseSubscriptionCut(remaining > 0);
      if (res.data.pixData) {
        setLeaveAfterPixClose(false);
        setPixEntityId(res.data.subscription.id);
        setPixEntityType('subscription');
        setPixModal(res.data.pixData);
      } else if (res.data.invoiceUrl) {
        window.location.href = res.data.invoiceUrl;
      } else {
        alert('Assinatura criada. Conclua o pagamento conforme as instruções enviadas (e-mail ou link).');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao assinar plano. Tente novamente.');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleCopyPix = async () => {
    if (!pixModal?.payload) return;
    await navigator.clipboard.writeText(pixModal.payload);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  const handlePayDebtWithPix = async () => {
    setIsPayingDebt(true);
    try {
      const res = await clientApi.post<{ pixData: PixData | null; totalAmount: number }>('/debts/my/pay-pix');
      if (res.data.pixData) {
        setDebtPixData(res.data.pixData);
        setDebtPollingActive(true);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao gerar PIX. Tente novamente.');
    } finally {
      setIsPayingDebt(false);
    }
  };

  const handleCopyDebtPix = async () => {
    if (!debtPixData?.payload) return;
    await navigator.clipboard.writeText(debtPixData.payload);
    setDebtPixCopied(true);
    setTimeout(() => setDebtPixCopied(false), 2000);
  };

  useEffect(() => {
    if (currentStep === 'schedule' && selectedServices.length > 0) {
      const serviceIds = selectedServices.map((s) => s.id);
      const date = formatDateISO(selectedDate);
      fetchAvailableProfessionals(serviceIds, date);
      // Limpar profissional selecionado ao mudar data/serviços
      setSelectedProfessional(null);
      setSelectedTime(null);
    }
  }, [currentStep, selectedDate, selectedServices, fetchAvailableProfessionals]);

  // Calcular duração total dos serviços selecionados
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);

  useEffect(() => {
    if (selectedProfessional && selectedDate) {
      fetchSlots(selectedProfessional.id, formatDateISO(selectedDate), totalDuration);
    } else {
      clearSlots();
    }
  }, [selectedProfessional, selectedDate, totalDuration, fetchSlots, clearSlots]);

  const handleServiceToggle = (service: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      }
      return [...prev, service];
    });
    setSelectedProfessional(null);
    setSelectedTime(null);
  };

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    } else {
      navigate(CLIENT_PATHS.home);
    }
  };

  const handleConfirm = async () => {
    if (!selectedProfessional || !selectedDate || !selectedTime) return;

    const usesSubscription = useSubscriptionCut && !!mySubscription;
    const needsPayment = totalPrice > 0 && !usesSubscription;

    setIsSubmitting(true);
    try {
      const result = await createAppointment({
        serviceIds: selectedServices.map((s) => s.id),
        professionalId: selectedProfessional.id,
        date: formatDateISO(selectedDate),
        startTime: selectedTime,
        useSubscriptionCut: usesSubscription,
        billingType: needsPayment ? appointmentBillingType : undefined,
      });

      if (appointmentBillingType === 'CASH' && needsPayment) {
        alert('Agendamento realizado! O pagamento será feito no local.');
        navigate(CLIENT_PATHS.home);
      } else if (result.payment?.pixData) {
        setLeaveAfterPixClose(true);
        setPixEntityId(result.id);
        setPixEntityType('appointment');
        setPixModal(result.payment.pixData);
      } else if (result.payment?.invoiceUrl) {
        window.location.href = result.payment.invoiceUrl;
      } else {
        alert('Agendamento realizado com sucesso!');
        navigate(CLIENT_PATHS.home);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar agendamento. Tente novamente.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'service':
        return selectedServices.length > 0;
      case 'schedule':
        return selectedProfessional !== null && selectedDate !== null && selectedTime !== null;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedServices, selectedProfessional, selectedDate, selectedTime]);

  const totalPrice = selectedServices.reduce((sum, s) => {
    const discount = getServiceDiscount(s.id, activePromotions);
    return sum + (discount !== null ? discountedPrice(s.price, discount) : s.price);
  }, 0);
  const stepIndex = STEPS.indexOf(currentStep);

  const todayISO = formatDateISO(new Date());

  // Step 1: Services
  const renderServiceStep = () => {
    if (servicesLoading) {
      return <LoadingState message="Carregando serviços..." />;
    }

    if (services.length === 0) {
      return <EmptyState icon="scissors" title="Nenhum serviço disponível" subtitle="Tente novamente mais tarde" />;
    }

    const remainingCuts = mySubscription
      ? mySubscription.plan.cutsPerMonth === 99
        ? 99
        : Math.max(mySubscription.plan.cutsPerMonth - mySubscription.cutsUsedThisMonth, 0)
      : 0;

    return (
      <div className="space-y-3">
        {services.map((service) => {
          const isSelected = selectedServices.some((s) => s.id === service.id);
          const discount = getServiceDiscount(service.id, activePromotions);
          const hasPromo = discount !== null;
          const promoPrice = hasPromo ? discountedPrice(service.price, discount) : service.price;
          return (
            <button
              key={service.id}
              onClick={() => handleServiceToggle(service)}
              className={`w-full flex items-center p-4 rounded-xl border transition-colors text-left ${
                isSelected
                  ? 'border-[#C8923A] border-2 bg-[#C8923A]/10'
                  : 'border-[var(--card-border)] bg-[var(--card-bg)]'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[var(--text-primary)]">{service.name}</p>
                  {hasPromo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#C8923A] text-[#1c1006] px-1.5 py-0.5 rounded">
                      {discount}% OFF
                    </span>
                  )}
                </div>
                {service.description && (
                  <p className="text-[var(--text-muted)] text-sm mt-1 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {hasPromo ? (
                    <>
                      <span className="text-[var(--text-muted)] text-sm line-through">
                        {formatPrice(service.price)}
                      </span>
                      <span className="text-[#C8923A] font-semibold text-sm">
                        {formatPrice(promoPrice)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#C8923A] font-semibold text-sm">
                      {formatPrice(service.price)}
                    </span>
                  )}
                  <span className="text-[var(--text-muted)] text-sm">
                    {formatDuration(service.duration)}
                  </span>
                </div>
              </div>
              {isSelected && (
                <svg className="w-6 h-6 text-[#C8923A]" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}

        {/* Seção de Planos */}
        {(mySubscription || plans.length > 0) && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-[var(--border-color)]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Planos
              </p>
              <div className="flex-1 h-px bg-[var(--border-color)]" />
            </div>

            {/* Assinatura ativa */}
            {mySubscription && mySubscription.status === 'ACTIVE' && (
              <div className="bg-gradient-to-r from-[#8B6914] to-[#C8923A] rounded-xl p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{mySubscription.plan.name}</p>
                  <p className="text-white/80 text-xs mt-0.5">
                    {mySubscription.plan.cutsPerMonth === 99
                      ? 'Créditos ilimitados'
                      : `${remainingCuts} crédito${remainingCuts !== 1 ? 's' : ''} restante${remainingCuts !== 1 ? 's' : ''} este mês`}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  {mySubscription.plan.cutsPerMonth === 99 ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  ) : (
                    <span className="text-white font-bold text-sm">{remainingCuts}</span>
                  )}
                </div>
              </div>
            )}

            {/* Aguardando pagamento */}
            {mySubscription && mySubscription.status === 'PENDING_PAYMENT' && (
              <div className="bg-[var(--card-bg)] border border-amber-500/40 rounded-xl p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{mySubscription.plan.name}</p>
                  <p className="text-xs text-amber-400">Aguardando pagamento</p>
                </div>
              </div>
            )}

            {/* Suspensa */}
            {mySubscription && mySubscription.status === 'SUSPENDED' && (
              <div className="bg-[var(--card-bg)] border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{mySubscription.plan.name}</p>
                    <p className="text-xs text-red-400">Assinatura suspensa por falta de pagamento</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(CLIENT_PATHS.planos)}
                  className="w-full py-2 bg-[#8B6914] hover:bg-[#725510] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Reativar assinatura
                </button>
              </div>
            )}

            {/* Planos disponíveis (sem assinatura) */}
            {!mySubscription && plans.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex-shrink-0 w-52 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4"
                  >
                    <p className="font-bold text-[var(--text-primary)] text-sm">{plan.name}</p>
                    {plan.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{plan.description}</p>
                    )}
                    <p className="text-[#C8923A] font-bold text-lg mt-2">{formatPrice(plan.price)}<span className="text-xs font-normal text-[var(--text-muted)]">/mês</span></p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-3">
                      {plan.cutsPerMonth === 99 ? 'Cortes ilimitados' : `${plan.cutsPerMonth} corte${plan.cutsPerMonth > 1 ? 's' : ''}/mês`}
                    </p>
                    <button
                      onClick={() => setSubscribePlanModal(plan.id)}
                      disabled={subscribingPlanId === plan.id}
                      className="w-full py-2 bg-[#8B6914] hover:bg-[#725510] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {subscribingPlanId === plan.id ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                      ) : 'Assinar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Step 2: Schedule (date + professional + time)
  const renderScheduleStep = () => {
    const grouped = groupSlotsByPeriod(slots);

    const renderSlotGroup = (label: string, groupSlots: TimeSlot[]) => {
      if (groupSlots.length === 0) return null;
      return (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-3">
            <p className="font-semibold text-[var(--text-primary)]">{label}</p>
            <div className="flex-1 h-px bg-[var(--border-color)]" />
            <span className="text-xs text-[var(--text-muted)] bg-[var(--hover-bg)] px-2 py-0.5 rounded-full">
              {groupSlots.length} {groupSlots.length === 1 ? 'horário' : 'horários'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {groupSlots.map((slot) => {
              const isSelected = selectedTime === slot.time;
              return (
                <button
                  key={slot.time}
                  onClick={() => setSelectedTime(slot.time)}
                  className={`py-3 rounded-lg border text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#8B6914] border-[#8B6914] text-white'
                      : 'bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text-primary)]'
                  }`}
                >
                  {slot.time.slice(0, 5)}
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Week Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            disabled={weekOffset <= 0}
            className="p-2 rounded-lg text-[var(--text-primary)] disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-base font-semibold text-[var(--text-primary)] capitalize">
            {getMonthYearLabel(selectedDate)}
          </p>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= 3}
            className="p-2 rounded-lg text-[var(--text-primary)] disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((label) => (
            <p key={label} className="text-center text-xs font-medium text-[var(--text-muted)]">
              {label}
            </p>
          ))}
        </div>

        {/* Week Dates */}
        <div className="grid grid-cols-7 gap-1 mb-6">
          {weekDates.map((date) => {
            const dateISO = formatDateISO(date);
            const isSelected = formatDateISO(selectedDate) === dateISO;
            const isToday = dateISO === todayISO;
            const isPast = dateISO < todayISO;
            return (
              <button
                key={dateISO}
                onClick={() => {
                  if (!isPast) {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }
                }}
                disabled={isPast}
                className={`py-2.5 rounded-full text-center transition-colors ${
                  isSelected
                    ? 'bg-[#8B6914] text-white'
                    : isToday
                    ? 'text-[#C8923A] font-bold'
                    : isPast
                    ? 'text-[var(--text-muted)] opacity-40'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                <span className="text-sm font-semibold">{date.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* Professionals */}
        <p className="font-semibold text-[var(--text-primary)] mb-3">Selecione o profissional</p>
        {professionalsLoading ? (
          <LoadingState message="Carregando profissionais..." />
        ) : professionals.length === 0 ? (
          <EmptyState icon="users" title="Nenhum profissional disponível" subtitle="Nenhum profissional realiza todos os serviços selecionados" />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-5 px-5 scrollbar-hide">
            {professionals.map((professional) => {
              const isSelected = selectedProfessional?.id === professional.id;
              return (
                <button
                  key={professional.id}
                  onClick={() => {
                    setSelectedProfessional(professional);
                    setSelectedTime(null);
                  }}
                  className="flex flex-col items-center flex-shrink-0 w-20"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-[#C8923A] ring-offset-2 ring-offset-[var(--bg-primary)] bg-[#C8923A]/20'
                      : 'bg-[var(--hover-bg)]'
                  }`}>
                    {professional.avatarUrl ? (
                      <img src={professional.avatarUrl} alt={professional.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg className={`w-7 h-7 ${isSelected ? 'text-[#C8923A]' : 'text-[var(--text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <p className={`mt-2 text-xs font-medium text-center leading-tight ${
                    isSelected ? 'text-[#C8923A]' : 'text-[var(--text-secondary)]'
                  }`}>
                    {professional.name.split(' ').slice(0, 2).join(' ')}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Divider */}
        {selectedProfessional && (
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent my-4" />
        )}

        {/* Time Slots */}
        {selectedProfessional && (
          <div>
            <p className="font-semibold text-[var(--text-primary)] text-lg mb-1">Horários disponíveis</p>
            {slotsLoading ? (
              <LoadingState message="Carregando horários..." />
            ) : slots.filter((s) => s.available).length === 0 ? (
              <EmptyState icon="clock" title="Nenhum horário disponível" subtitle="Escolha outra data ou profissional" />
            ) : (
              <div>
                {renderSlotGroup('Manhã', grouped.manha)}
                {renderSlotGroup('Tarde', grouped.tarde)}
                {renderSlotGroup('Noite', grouped.noite)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Step 3: Confirmation
  const renderConfirmStep = () => (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-5">Resumo do agendamento</h3>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--text-muted)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
          </svg>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Serviços</p>
            {selectedServices.map((s) => {
              const disc = getServiceDiscount(s.id, activePromotions);
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <p className="text-[var(--text-primary)] font-medium">{s.name}</p>
                  {disc !== null ? (
                    <>
                      <span className="text-xs text-[var(--text-muted)] line-through">{formatPrice(s.price)}</span>
                      <span className="text-xs font-semibold text-[#C8923A]">{formatPrice(discountedPrice(s.price, disc))}</span>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">{formatPrice(s.price)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--text-muted)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Profissional</p>
            <p className="text-[var(--text-primary)] font-medium">{selectedProfessional?.name}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--text-muted)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Data e horário</p>
            <p className="text-[var(--text-primary)] font-medium">
              {selectedDate && formatDateLong(formatDateISO(selectedDate))} as {selectedTime?.slice(0, 5)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--text-muted)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Duração estimada</p>
            <p className="text-[var(--text-primary)] font-medium">{formatDuration(totalDuration)}</p>
          </div>
        </div>

        <div className="border-t border-[var(--border-color)] my-4"></div>

        {totalPrice > 0 && !(useSubscriptionCut && mySubscription) && (
          <div className="mb-4">
            <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAppointmentBillingType('PIX')}
                className={`rounded-xl border py-3 px-2 text-sm font-semibold transition-colors ${
                  appointmentBillingType === 'PIX'
                    ? 'border-[#C8923A] bg-[#C8923A]/15 text-[#C8923A]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)]'
                }`}
              >
                PIX
              </button>
              <button
                type="button"
                onClick={() => setAppointmentBillingType('CREDIT_CARD')}
                className={`rounded-xl border py-3 px-2 text-sm font-semibold transition-colors ${
                  appointmentBillingType === 'CREDIT_CARD'
                    ? 'border-[#C8923A] bg-[#C8923A]/15 text-[#C8923A]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)]'
                }`}
              >
                Cartão
              </button>
              <button
                type="button"
                onClick={() => setAppointmentBillingType('CASH')}
                className={`rounded-xl border py-3 px-2 text-sm font-semibold transition-colors ${
                  appointmentBillingType === 'CASH'
                    ? 'border-[#C8923A] bg-[#C8923A]/15 text-[#C8923A]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)]'
                }`}
              >
                No local
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {appointmentBillingType === 'PIX'
                ? 'Você verá o QR Code após confirmar.'
                : appointmentBillingType === 'CREDIT_CARD'
                ? 'Abriremos o link seguro do Asaas para pagar com cartão.'
                : 'Pague na hora do serviço (dinheiro, cartão ou PIX na maquininha).'}
            </p>
          </div>
        )}

        {/* Opção de usar crédito do plano */}
        {mySubscription && (() => {
          const remaining = mySubscription.plan.cutsPerMonth === 99
            ? 99
            : Math.max(mySubscription.plan.cutsPerMonth - mySubscription.cutsUsedThisMonth, 0);
          return (
            <button
              onClick={() => remaining > 0 && setUseSubscriptionCut((v) => !v)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors mb-4 ${
                useSubscriptionCut && remaining > 0
                  ? 'border-[#C8923A] bg-[#C8923A]/10'
                  : 'border-[var(--card-border)] bg-[var(--card-bg)]'
              } ${remaining === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                useSubscriptionCut && remaining > 0
                  ? 'border-[#C8923A] bg-[#C8923A]'
                  : 'border-[var(--border-color)]'
              }`}>
                {useSubscriptionCut && remaining > 0 && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Usar crédito do plano
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {mySubscription.plan.name} ·{' '}
                  {remaining === 0
                    ? 'Sem créditos disponíveis'
                    : mySubscription.plan.cutsPerMonth === 99
                    ? 'Ilimitado'
                    : `${remaining} crédito${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
                </p>
              </div>
            </button>
          );
        })()}

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[#C8923A] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Total</p>
            <p className="text-xl font-bold text-[#C8923A]">
              {useSubscriptionCut && mySubscription ? 'Pelo plano' : formatPrice(totalPrice)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'service':
        return renderServiceStep();
      case 'schedule':
        return renderScheduleStep();
      case 'confirm':
        return renderConfirmStep();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="flex items-center px-2 py-3">
        <button onClick={handleBack} className="p-2">
          <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-[var(--text-primary)]">
          {STEP_TITLES[currentStep]}
        </h1>
        <button onClick={() => navigate(CLIENT_PATHS.home)} className="p-2">
          <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="flex justify-center gap-2 py-2">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-colors ${
              index <= stepIndex ? 'bg-[#C8923A]' : 'bg-[var(--border-color)]'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {renderStepContent()}
      </div>

      {/* Modal de bloqueio por dívida pendente */}
      {debtData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">Pagamento pendente</h3>
                <p className="text-xs text-red-400">Você possui uma dívida com o salão</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {!debtPixData ? (
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Para fazer um novo agendamento, quite sua dívida primeiro:
                  </p>
                  <p className="text-4xl font-extrabold text-red-400 mb-1">
                    R$ {(debtData.total / 100).toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mb-6">valor total em aberto</p>
                  <button
                    onClick={handlePayDebtWithPix}
                    disabled={isPayingDebt}
                    className="w-full py-4 bg-[#8B6914] hover:bg-[#725510] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-[#8B6914]/20 mb-3"
                  >
                    {isPayingDebt ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                        Pagar com PIX
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    Escaneie o QR Code ou copie o código para quitar sua dívida
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-[#C8923A] to-[#8B6914] rounded-xl blur opacity-25"></div>
                      <div className="relative bg-white p-3 rounded-xl shadow-inner">
                        <img
                          src={`data:image/png;base64,${debtPixData.encodedImage}`}
                          alt="QR Code PIX"
                          className="h-44 w-44"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyDebtPix}
                    className="w-full py-3 rounded-xl border-2 border-[#C8923A] text-[#C8923A] font-semibold hover:bg-[#C8923A]/10 flex items-center justify-center gap-2 transition-colors mb-4"
                  >
                    {debtPixCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copiado!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copiar código PIX
                      </>
                    )}
                  </button>
                  <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#C8923A]"></div>
                    <span>Aguardando confirmação do pagamento...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={() => navigate(CLIENT_PATHS.home)}
                className="w-full py-2.5 text-sm text-[var(--text-muted)] font-medium hover:text-[var(--text-secondary)] transition-colors"
              >
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal PIX após assinar plano */}
      {pixModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Pagar com PIX</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold px-2 py-0.5 rounded-lg ${
                    pixCountdown <= 60
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-orange-500/10 text-orange-500'
                  }`}
                >
                  {`${Math.floor(pixCountdown / 60)}:${String(pixCountdown % 60).padStart(2, '0')}`}
                </span>
                <button
                  onClick={() => {
                    setPixModal(null);
                    setPixEntityId(null);
                    setPixEntityType(null);
                    if (leaveAfterPixClose) {
                      setLeaveAfterPixClose(false);
                      navigate(CLIENT_PATHS.home);
                    }
                  }}
                  className="p-1 text-[var(--text-muted)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] text-center mb-2">
              Escaneie o QR Code ou copie o código PIX para ativar seu plano
            </p>
            <p className={`text-xs text-center mb-4 font-medium ${pixCountdown <= 60 ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
              {pixCountdown <= 60
                ? `Atenção! Expira em ${Math.floor(pixCountdown / 60)}:${String(pixCountdown % 60).padStart(2, '0')} — pedido será cancelado.`
                : 'Código válido por 10 minutos. Após isso, o pedido é cancelado automaticamente.'}
            </p>
            {pixModal.encodedImage && (
              <div className="flex justify-center mb-4">
                <img
                  src={`data:image/png;base64,${pixModal.encodedImage}`}
                  alt="QR Code PIX"
                  className="w-44 h-44 rounded-xl"
                />
              </div>
            )}
            <button
              onClick={handleCopyPix}
              className="w-full py-3 rounded-xl border-2 border-[#C8923A] text-[#C8923A] font-semibold hover:bg-[#C8923A]/10 flex items-center justify-center gap-2 transition-colors"
            >
              {pixCopied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar código PIX
                </>
              )}
            </button>
            <p className="text-xs text-center text-[var(--text-muted)] mt-3">
              Após o pagamento, seus créditos são liberados automaticamente
            </p>
          </div>
        </div>
      )}

      {subscribePlanModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-sm p-6 border border-[var(--card-border)] shadow-xl">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Assinar plano</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              A assinatura será cobrada automaticamente no cartão de crédito todo mês.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => subscribeFromBooking(subscribePlanModal, 'CREDIT_CARD')}
                disabled={!!subscribingPlanId}
                className="w-full py-3 rounded-xl bg-[#8B6914] text-white font-semibold hover:bg-[#725510] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Pagar com cartão de crédito
              </button>
              <button
                type="button"
                onClick={() => setSubscribePlanModal(null)}
                disabled={!!subscribingPlanId}
                className="w-full py-2.5 text-sm text-[var(--text-muted)] font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)] p-4 flex items-center gap-4">
        {selectedServices.length > 0 && currentStep !== 'confirm' && (
          <div className="flex-1">
            <p className="text-lg font-bold text-[var(--text-primary)]">{formatPrice(totalPrice)}</p>
            <p className="text-xs text-[var(--text-muted)]">{formatDuration(totalDuration)}</p>
          </div>
        )}
        <button
          onClick={currentStep === 'confirm' ? handleConfirm : handleNext}
          disabled={!canProceed() || isSubmitting}
          className={`h-12 px-6 rounded-xl font-semibold text-white transition-colors flex items-center justify-center ${
            selectedServices.length > 0 && currentStep !== 'confirm' ? '' : 'flex-1'
          } ${
            canProceed() && !isSubmitting
              ? 'bg-[#8B6914] hover:bg-[#725510]'
              : 'bg-[var(--hover-bg)] text-[var(--text-muted)] cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : currentStep === 'confirm' ? (
            'Confirmar Agendamento'
          ) : (
            'Continuar'
          )}
        </button>
      </div>
    </div>
  );
}
