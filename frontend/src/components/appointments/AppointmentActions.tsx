import { useState } from 'react';
import { MoreVertical, Check, X, UserX } from 'lucide-react';
import { ConfirmModal } from '@/components/ui';
import type { Appointment } from '@/types';

interface AppointmentActionsProps {
  appointment: Appointment;
  onAttend: (id: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
  onNoShow: (id: string) => Promise<unknown>;
  disabled?: boolean;
}

export function AppointmentActions({
  appointment,
  onAttend,
  onCancel,
  onNoShow,
  disabled,
}: AppointmentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const canModify = appointment.status === 'SCHEDULED';

  const handleAction = async (action: () => Promise<unknown>) => {
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleCancelClick = () => {
    setIsOpen(false);
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = async () => {
    setIsLoading(true);
    try {
      await onCancel(appointment.id);
      setShowCancelConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canModify) {
    return <span className="text-sm text-[var(--text-muted)]">-</span>;
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Ações do agendamento"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-1 shadow-lg">
              <button
                onClick={() => handleAction(() => onAttend(appointment.id))}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
              >
                <Check className="h-4 w-4 text-[#C8923A]" />
                Marcar Atendido
              </button>

              <button
                onClick={() => handleAction(() => onNoShow(appointment.id))}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
              >
                <UserX className="h-4 w-4 text-[#A63030]" />
                Não Compareceu
              </button>

              <button
                onClick={handleCancelClick}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#A63030] hover:bg-red-500/10 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmação de cancelamento */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleConfirmCancel}
        title="Cancelar Agendamento"
        message={`Tem certeza que deseja cancelar o agendamento de ${appointment.client?.name || 'este cliente'}? Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar Agendamento"
        cancelLabel="Voltar"
        variant="danger"
        isLoading={isLoading}
      />
    </>
  );
}
