import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientServices, useClientProfessionals, useAvailableSlots, useClientAppointments } from '../hooks';
import { LoadingState, EmptyState } from '../components/ui';
import { formatPrice, formatDuration, formatDateISO, formatWeekday, formatDateShort, formatDateLong } from '../utils/format';
import type { Service, Professional } from '../types';

type Step = 'service' | 'professional' | 'datetime' | 'confirm';

const STEPS: Step[] = ['service', 'professional', 'datetime', 'confirm'];
const STEP_TITLES: Record<Step, string> = {
  service: 'Escolha o servico',
  professional: 'Escolha o profissional',
  datetime: 'Escolha data e horario',
  confirm: 'Confirmar agendamento',
};

function generateDates(count: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function ClientBooking() {
  const [currentStep, setCurrentStep] = useState<Step>('service');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const { services, isLoading: servicesLoading, fetchServices } = useClientServices();
  const { professionals, isLoading: professionalsLoading, fetchProfessionals } = useClientProfessionals();
  const { slots, isLoading: slotsLoading, fetchSlots, clearSlots } = useAvailableSlots();
  const { createAppointment } = useClientAppointments();

  const dates = useMemo(() => generateDates(14), []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (currentStep === 'professional') {
      fetchProfessionals();
    }
  }, [currentStep, fetchProfessionals]);

  useEffect(() => {
    if (selectedProfessional && selectedDate) {
      fetchSlots(selectedProfessional.id, formatDateISO(selectedDate));
    } else {
      clearSlots();
    }
  }, [selectedProfessional, selectedDate, fetchSlots, clearSlots]);

  const handleServiceToggle = (service: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      }
      return [...prev, service];
    });
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
      navigate('/cliente');
    }
  };

  const handleConfirm = async () => {
    if (!selectedProfessional || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    const appointment = await createAppointment({
      serviceIds: selectedServices.map((s) => s.id),
      professionalId: selectedProfessional.id,
      date: formatDateISO(selectedDate),
      startTime: selectedTime,
    });

    setIsSubmitting(false);

    if (appointment) {
      alert('Agendamento realizado com sucesso!');
      navigate('/cliente');
    } else {
      alert('Erro ao criar agendamento. Tente novamente.');
    }
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'service':
        return selectedServices.length > 0;
      case 'professional':
        return selectedProfessional !== null;
      case 'datetime':
        return selectedDate !== null && selectedTime !== null;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedServices, selectedProfessional, selectedDate, selectedTime]);

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const stepIndex = STEPS.indexOf(currentStep);

  // Step 1: Services
  const renderServiceStep = () => {
    if (servicesLoading) {
      return <LoadingState message="Carregando servicos..." />;
    }

    if (services.length === 0) {
      return <EmptyState icon="scissors" title="Nenhum servico disponivel" subtitle="Tente novamente mais tarde" />;
    }

    return (
      <div className="space-y-3">
        {services.map((service) => {
          const isSelected = selectedServices.some((s) => s.id === service.id);
          return (
            <button
              key={service.id}
              onClick={() => handleServiceToggle(service)}
              className={`w-full flex items-center p-4 rounded-xl border transition-colors text-left ${
                isSelected
                  ? 'border-teal-500 border-2 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">{service.name}</p>
                {service.description && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-teal-600 dark:text-teal-400 font-semibold text-sm">
                    {formatPrice(service.price)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 text-sm">
                    {formatDuration(service.duration)}
                  </span>
                </div>
              </div>
              {isSelected && (
                <svg className="w-6 h-6 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Step 2: Professionals
  const renderProfessionalStep = () => {
    if (professionalsLoading) {
      return <LoadingState message="Carregando profissionais..." />;
    }

    if (professionals.length === 0) {
      return <EmptyState icon="users" title="Nenhum profissional disponivel" subtitle="Tente novamente mais tarde" />;
    }

    return (
      <div className="space-y-3">
        {professionals.map((professional) => {
          const isSelected = selectedProfessional?.id === professional.id;
          return (
            <button
              key={professional.id}
              onClick={() => setSelectedProfessional(professional)}
              className={`w-full flex items-center p-4 rounded-xl border transition-colors text-left ${
                isSelected
                  ? 'border-teal-500 border-2 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">{professional.name}</p>
                {professional.services && professional.services.length > 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                    {professional.services.map((s) => s.name).join(' - ')}
                  </p>
                )}
              </div>
              {isSelected && (
                <svg className="w-6 h-6 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Step 3: Date/Time
  const renderDateTimeStep = () => (
    <div>
      <p className="font-semibold text-gray-900 dark:text-white mb-3">Selecione a data</p>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
        {dates.map((date) => {
          const isSelected = selectedDate && formatDateISO(date) === formatDateISO(selectedDate);
          const isToday = formatDateISO(date) === formatDateISO(new Date());
          return (
            <button
              key={date.toISOString()}
              onClick={() => {
                setSelectedDate(date);
                setSelectedTime(null);
              }}
              className={`flex-shrink-0 w-[72px] py-3 rounded-xl border text-center transition-colors ${
                isSelected
                  ? 'bg-teal-500 border-teal-500 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className={`text-xs font-medium capitalize ${isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                {isToday ? 'Hoje' : formatWeekday(date)}
              </p>
              <p className={`text-sm font-semibold mt-1 ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {formatDateShort(date)}
              </p>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-6">
          <p className="font-semibold text-gray-900 dark:text-white mb-3">Horarios disponiveis</p>
          {slotsLoading ? (
            <LoadingState message="Carregando horarios..." />
          ) : slots.length === 0 ? (
            <EmptyState icon="clock" title="Nenhum horario disponivel" subtitle="Escolha outra data" />
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {slots.map((slot) => {
                const isSelected = selectedTime === slot.time;
                const isAvailable = slot.available;
                return (
                  <button
                    key={slot.time}
                    onClick={() => isAvailable && setSelectedTime(slot.time)}
                    disabled={!isAvailable}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : isAvailable
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {slot.time.slice(0, 5)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Step 4: Confirmation
  const renderConfirmStep = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Resumo do agendamento</h3>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Servicos</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {selectedServices.map((s) => s.name).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Profissional</p>
            <p className="text-gray-900 dark:text-white font-medium">{selectedProfessional?.name}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Data e horario</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {selectedDate && formatDateLong(selectedDate.toISOString())} as {selectedTime?.slice(0, 5)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Duracao estimada</p>
            <p className="text-gray-900 dark:text-white font-medium">{formatDuration(totalDuration)}</p>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-teal-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{formatPrice(totalPrice)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'service':
        return renderServiceStep();
      case 'professional':
        return renderProfessionalStep();
      case 'datetime':
        return renderDateTimeStep();
      case 'confirm':
        return renderConfirmStep();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center px-2 py-3">
        <button onClick={handleBack} className="p-2">
          <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-gray-900 dark:text-white">
          {STEP_TITLES[currentStep]}
        </h1>
        <button onClick={() => navigate('/cliente')} className="p-2">
          <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              index <= stepIndex ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {renderStepContent()}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
        {selectedServices.length > 0 && currentStep !== 'confirm' && (
          <div className="flex-1">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatPrice(totalPrice)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(totalDuration)}</p>
          </div>
        )}
        <button
          onClick={currentStep === 'confirm' ? handleConfirm : handleNext}
          disabled={!canProceed() || isSubmitting}
          className={`h-12 px-6 rounded-xl font-semibold text-white transition-colors flex items-center justify-center ${
            selectedServices.length > 0 && currentStep !== 'confirm' ? '' : 'flex-1'
          } ${
            canProceed() && !isSubmitting
              ? 'bg-teal-500 hover:bg-teal-600'
              : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
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
