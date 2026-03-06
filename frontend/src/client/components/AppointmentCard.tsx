import { formatDate, formatTime, formatEndTime, formatPrice, hoursUntil } from '../utils/format';
import type { Appointment, AppointmentStatus } from '../types';

const CANCELLATION_HOURS_LIMIT = 2;

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; bgColor: string; textColor: string }> = {
  SCHEDULED: { label: 'Agendado', bgColor: 'bg-[#C8923A]/20', textColor: 'text-[#C8923A]' },
  ATTENDED: { label: 'Concluido', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-400' },
  CANCELED: { label: 'Cancelado', bgColor: 'bg-[#8B2020]/20', textColor: 'text-[#A63030]' },
  NO_SHOW: { label: 'Nao compareceu', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-400' },
};

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (appointment: Appointment) => void;
  isCancelling?: boolean;
  variant?: 'default' | 'highlight';
}

export function AppointmentCard({
  appointment,
  onCancel,
  isCancelling = false,
  variant = 'default',
}: AppointmentCardProps) {
  const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.SCHEDULED;
  const canCancel =
    appointment.status === 'SCHEDULED' &&
    hoursUntil(appointment.scheduledAt) > CANCELLATION_HOURS_LIMIT;

  const isHighlight = variant === 'highlight';

  return (
    <div
      className={`rounded-xl p-4 border ${
        isHighlight
          ? 'bg-[#C8923A]/10 border-[#C8923A]'
          : 'bg-[var(--card-bg)] border-[var(--card-border)]'
      }`}
    >
      {isHighlight && (
        <div className="inline-flex items-center gap-1 bg-[#8B6914] text-white text-xs font-semibold px-2 py-1 rounded-md mb-3">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Proximo
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            {formatDate(appointment.scheduledAt)}
          </p>
          <p className="text-[#C8923A] font-medium text-sm mt-0.5">
            {formatTime(appointment.scheduledAt)} - {formatEndTime(appointment.scheduledAt, appointment.totalDuration)}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${status.bgColor} ${status.textColor}`}>
          {status.label}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
          </svg>
          <span className="text-sm">{(appointment.services || []).map((s) => s.service?.name || 'Servico').join(', ')}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm">{appointment.professional?.name || 'Profissional'}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-sm">{formatPrice(appointment.totalPrice)}</span>
        </div>
      </div>

      {canCancel && onCancel && (
        <button
          onClick={() => onCancel(appointment)}
          disabled={isCancelling}
          className={`w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#8B2020]/10 text-[#A63030] font-medium text-sm transition-colors hover:bg-[#8B2020]/20 ${
            isCancelling ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          {isCancelling ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#A63030]"></div>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cancelar agendamento
            </>
          )}
        </button>
      )}
    </div>
  );
}
