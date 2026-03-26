import { useState, useEffect } from 'react';
import { formatDate, formatTime, formatEndTime, formatPrice, hoursUntil } from '../utils/format';
import { clientApi } from '../services/api';
import { appointmentsApi } from '../services/appointments';
import type { Appointment, AppointmentStatus } from '../types';
import { PixPaymentModal } from './ui';

const CANCELLATION_HOURS_LIMIT = 1;

// Cache do WhatsApp para não buscar toda hora
let cachedWhatsapp: string | null = null;
async function getWhatsapp(): Promise<string> {
  if (cachedWhatsapp !== null) return cachedWhatsapp;
  try {
    const { data } = await clientApi.get('/settings/whatsapp');
    cachedWhatsapp = data.whatsapp || '';
  } catch {
    cachedWhatsapp = '';
  }
  return cachedWhatsapp!;
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; bgColor: string; textColor: string }> = {
  SCHEDULED: { label: 'Agendado', bgColor: 'bg-[#C8923A]/20', textColor: 'text-[#C8923A]' },
  ATTENDED: { label: 'Concluído', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-400' },
  CANCELED: { label: 'Cancelado', bgColor: 'bg-[#8B2020]/20', textColor: 'text-[#A63030]' },
  NO_SHOW: { label: 'Não compareceu', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-400' },
  PENDING_PAYMENT: { label: 'Aguard. Pagamento', bgColor: 'bg-amber-500/20', textColor: 'text-amber-500' },
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
  const hours = hoursUntil(appointment.scheduledAt);
  const isScheduled = appointment.status === 'SCHEDULED';
  const canCancel = isScheduled && hours > CANCELLATION_HOURS_LIMIT;
  const showContactButton = isScheduled && hours > 0 && hours <= CANCELLATION_HOURS_LIMIT;

  const isPendingPayment = appointment.status === 'PENDING_PAYMENT';

  const isHighlight = variant === 'highlight';
  const [whatsapp, setWhatsapp] = useState('');
  const [pendingPixData, setPendingPixData] = useState<{ encodedImage: string; payload: string; expirationDate: string } | null>(null);
  const [showPixModal, setShowPixModal] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);

  useEffect(() => {
    if (showContactButton) {
      getWhatsapp().then(setWhatsapp);
    }
  }, [showContactButton]);

  const handleViewPixQrCode = async () => {
    if (pendingPixData) {
      setShowPixModal(true);
      return;
    }
    setLoadingPix(true);
    try {
      const res = await clientApi.get<{ pixData: { encodedImage: string; payload: string; expirationDate: string }; totalPrice: number }>(
        `/appointments/${appointment.id}/pending-pix`,
      );
      if (res.data.pixData) {
        setPendingPixData(res.data.pixData);
        setShowPixModal(true);
      }
    } catch {
      alert('Não foi possível carregar o QR Code. Tente novamente.');
    } finally {
      setLoadingPix(false);
    }
  };

  const handleContact = () => {
    if (!whatsapp) {
      alert('Número de WhatsApp da barbearia não configurado. Entre em contato por telefone.');
      return;
    }
    const services = (appointment.services || []).map((s) => s.service?.name || 'Serviço').join(', ');
    const time = formatTime(appointment.scheduledAt);
    const message = `Olá! Gostaria de cancelar meu agendamento de ${services} às ${time}. Poderia me ajudar?`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
  };

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
          Próximo
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
          <span className="text-sm">{(appointment.services || []).map((s) => s.service?.name || 'Serviço').join(', ')}</span>
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

      {(canCancel && onCancel) || isPendingPayment ? (
        <div className="flex gap-2 mt-4">
          {isPendingPayment && (
            <button
              onClick={handleViewPixQrCode}
              disabled={loadingPix}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500/15 text-amber-500 font-medium text-sm transition-colors hover:bg-amber-500/25 disabled:opacity-60"
            >
              {loadingPix ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Ver QR Code
                </>
              )}
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(appointment)}
              disabled={isCancelling}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#8B2020]/10 text-[#A63030] font-medium text-sm transition-colors hover:bg-[#8B2020]/20 ${
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
                  Cancelar
                </>
              )}
            </button>
          )}
        </div>
      ) : null}

      {showPixModal && pendingPixData && (
        <PixPaymentModal
          isOpen={showPixModal}
          onClose={() => setShowPixModal(false)}
          pixData={pendingPixData}
          amount={appointment.totalPrice}
          description="Pagamento do agendamento"
        />
      )}

      {/* Rating for attended appointments */}
      {appointment.status === 'ATTENDED' && !appointment.rating && (
        <RatingSection appointmentId={appointment.id} />
      )}
      {appointment.status === 'ATTENDED' && appointment.rating && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Sua avaliacao:</span>
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`w-4 h-4 ${star <= appointment.rating! ? 'text-[#C8923A]' : 'text-[var(--text-muted)]/30'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
      )}

      {showContactButton && (
        <button
          onClick={handleContact}
          className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600/10 text-green-600 font-medium text-sm transition-colors hover:bg-green-600/20"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.252-.148-2.697.707.72-2.633-.168-.268A8 8 0 1112 20z" />
          </svg>
          Falar com a barbearia para cancelar
        </button>
      )}
    </div>
  );
}

function RatingSection({ appointmentId }: { appointmentId: string }) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState(false);

  const handleRate = async (rating: number) => {
    setSelectedStar(rating);
    setSubmitting(true);
    setError(false);
    try {
      await appointmentsApi.rate(appointmentId, rating);
      setSubmitted(true);
    } catch {
      setSelectedStar(0);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-3 flex items-center gap-1.5 text-xs text-green-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Obrigado pela avaliacao!
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-[var(--text-muted)] mb-1.5">Como foi o atendimento?</p>
      {error && <p className="text-xs text-[#A63030] mb-1">Erro ao salvar. Tente novamente.</p>}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={submitting}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => handleRate(star)}
            className="p-0.5 disabled:opacity-50"
          >
            <svg
              className={`w-6 h-6 transition-colors ${
                star <= (hoveredStar || selectedStar)
                  ? 'text-[#C8923A]'
                  : 'text-[var(--text-muted)]/30'
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
