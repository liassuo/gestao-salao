import { useState } from 'react';
import { Clock, Phone, Check, UserX, Edit2, Save, XCircle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { CalendarAppointment } from '@/types';

const statusConfig: Record<string, { label: string; classes: string }> = {
  SCHEDULED: { label: 'Agendado', classes: 'text-[#D4A85C] bg-[#C8923A]/20 border border-[#C8923A]/40' },
  PENDING_PAYMENT: { label: 'Pagamento Pendente', classes: 'text-blue-400 bg-blue-500/20 border border-blue-500/40' },
  ATTENDED: { label: 'Atendido', classes: 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/40' },
  CANCELLED: { label: 'Cancelado', classes: 'text-[#C45050] bg-red-500/15 border border-[#A63030]/30' },
  NO_SHOW: { label: 'Não Compareceu', classes: 'text-amber-400 bg-amber-500/15 border border-amber-500/30' },
};

function formatDateBR(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function extractTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function extractEditValues(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

interface AppointmentDetailModalProps {
  appointment: CalendarAppointment | null;
  professionalName: string;
  isOpen: boolean;
  onClose: () => void;
  onAttend: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onNoShow: (id: string) => Promise<void>;
  onUpdate: (id: string, data: { scheduledAt?: string; notes?: string }) => Promise<void>;
}

export function AppointmentDetailModal({
  appointment,
  professionalName,
  isOpen,
  onClose,
  onAttend,
  onCancel,
  onNoShow,
  onUpdate,
}: AppointmentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isActing, setIsActing] = useState(false);

  if (!appointment) return null;

  const status = statusConfig[appointment.status] || statusConfig.SCHEDULED;
  const startTime = extractTime(appointment.scheduledAt);
  const endMinutes =
    parseInt(startTime.split(':')[0]) * 60 +
    parseInt(startTime.split(':')[1]) +
    appointment.totalDuration;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  const isScheduled = appointment.status === 'SCHEDULED' || appointment.status === 'PENDING_PAYMENT';

  const handleStartEdit = () => {
    const vals = extractEditValues(appointment.scheduledAt);
    setEditDate(vals.date);
    setEditTime(vals.time);
    setEditNotes(appointment.notes || '');
    setIsEditing(true);
    setIsConfirmingCancel(false);
  };

  const handleCancelEdit = () => setIsEditing(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(appointment.id, {
        scheduledAt: `${editDate}T${editTime}:00`,
        notes: editNotes || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setIsActing(true);
    try {
      await action();
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--card-border)]';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Agendamento" size="md">
      <div className="space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.classes}`}>
            {status.label}
          </span>
          {!isEditing && isScheduled && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
        </div>

        {/* Client */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Cliente
          </div>
          <div className="font-semibold text-[var(--text-primary)]">
            {appointment.client?.name || '—'}
          </div>
          {appointment.client?.phone && (
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
              <Phone className="h-3.5 w-3.5" />
              {appointment.client.phone}
            </div>
          )}
        </div>

        {/* Professional */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Profissional
          </div>
          <div className="font-semibold text-[var(--text-primary)]">{professionalName}</div>
        </div>

        {/* Services */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Serviços
          </div>
          <ul className="space-y-1">
            {(appointment.services || []).map((s, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)]">
                • {s.service?.name || 'Serviço'}
              </li>
            ))}
          </ul>
        </div>

        {/* Date/Time */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Data e Horário
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className={inputClass}
              />
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-32 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
              />
            </div>
          ) : (
            <>
              <div className="text-sm font-medium capitalize text-[var(--text-primary)]">
                {formatDateBR(appointment.scheduledAt)}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <Clock className="h-3.5 w-3.5" />
                {startTime} – {endTime} ({formatDuration(appointment.totalDuration)})
              </div>
            </>
          )}
        </div>

        {/* Price */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Valor
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {formatCurrency(appointment.totalPrice)}
            </span>
            {appointment.isPaid ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                Pago
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                Pendente
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Observações
          </div>
          {isEditing ? (
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Adicionar observações..."
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
            />
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              {appointment.notes ? (
                appointment.notes
              ) : (
                <span className="italic text-[var(--text-muted)]">Nenhuma observação</span>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        {isEditing ? (
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !editDate || !editTime}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#725510] disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </button>
          </div>
        ) : isScheduled ? (
          isConfirmingCancel ? (
            <div className="rounded-xl border border-[#A63030]/30 bg-red-500/10 p-4">
              <p className="mb-3 text-sm text-[var(--text-secondary)]">
                Confirmar cancelamento do agendamento de{' '}
                <strong>{appointment.client?.name}</strong>?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsConfirmingCancel(false)}
                  disabled={isActing}
                  className="rounded-xl border border-[var(--card-border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50"
                >
                  Não
                </button>
                <button
                  onClick={() => handleAction(() => onCancel(appointment.id))}
                  disabled={isActing}
                  className="flex items-center gap-1.5 rounded-xl bg-[#A63030] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#8B2020] disabled:opacity-50"
                >
                  {isActing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => handleAction(() => onAttend(appointment.id))}
                disabled={isActing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isActing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Atendido
              </button>
              <button
                onClick={() => handleAction(() => onNoShow(appointment.id))}
                disabled={isActing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
              >
                {isActing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserX className="h-4 w-4" />
                )}
                Não Compareceu
              </button>
              <button
                onClick={() => setIsConfirmingCancel(true)}
                disabled={isActing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-medium text-[#C45050] transition-colors hover:bg-red-500/25 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          )
        ) : null}
      </div>
    </Modal>
  );
}
