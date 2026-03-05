import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../auth';
import { useClientAppointments } from '../hooks';
import { AppointmentCard } from '../components/AppointmentCard';
import { LoadingState, EmptyState } from '../components/ui';
import { PromotionBanners } from '../components/PromotionBanners';
import type { Appointment } from '../types';

export function ClientHome() {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useClientAuth();

  const {
    upcomingAppointments,
    pastAppointments,
    nextAppointment,
    isLoading,
    fetchAppointments,
    cancelAppointment,
  } = useClientAppointments();

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancel = useCallback(
    async (appointment: Appointment) => {
      if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
        return;
      }

      setCancellingId(appointment.id);
      const success = await cancelAppointment(appointment.id);
      if (success) {
        alert('Agendamento cancelado com sucesso!');
      } else {
        alert('Erro ao cancelar agendamento. Tente novamente.');
      }
      setCancellingId(null);
    },
    [cancelAppointment]
  );

  if (isLoading) {
    return <LoadingState fullScreen message="Carregando seus agendamentos..." />;
  }

  const otherUpcoming = upcomingAppointments.slice(1);
  const hasAppointments = upcomingAppointments.length > 0 || pastAppointments.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="sticky top-0 bg-[var(--bg-primary)] z-10 px-5 py-4 flex justify-between items-center">
        <div>
          <p className="text-[var(--text-muted)] text-sm">
            Ola, {user?.name?.split(' ')[0] || 'Cliente'}
          </p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">
            Meus Agendamentos
          </h1>
        </div>
        <button
          onClick={() => navigate('/cliente/perfil')}
          className="w-11 h-11 rounded-full bg-[#C8923A]/20 flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-[#C8923A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </div>

      {/* Banners de Promocoes */}
      <PromotionBanners />

      {/* Content */}
      <div className="px-5 pb-24">
        {!hasAppointments ? (
          <EmptyState
            icon="calendar"
            title="Nenhum agendamento"
            subtitle="Agende seu primeiro horario tocando no botao abaixo!"
          />
        ) : (
          <div className="space-y-6">
            {/* Next Appointment */}
            {nextAppointment && (
              <div>
                <AppointmentCard
                  appointment={nextAppointment}
                  variant="highlight"
                  onCancel={handleCancel}
                  isCancelling={cancellingId === nextAppointment.id}
                />
              </div>
            )}

            {/* Other Upcoming */}
            {otherUpcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Proximos agendamentos
                  </h2>
                  <span className="bg-[#C8923A]/20 text-[#C8923A] text-xs font-semibold px-2 py-0.5 rounded-full">
                    {otherUpcoming.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {otherUpcoming.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onCancel={handleCancel}
                      isCancelling={cancellingId === appointment.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Historico
                  </h2>
                  <span className="bg-[var(--hover-bg)] text-[var(--text-muted)] text-xs font-semibold px-2 py-0.5 rounded-full">
                    {pastAppointments.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {pastAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/cliente/agendar')}
        className="fixed right-5 bottom-5 w-14 h-14 bg-[#8B6914] hover:bg-[#725510] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
