import { useState, useEffect } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';
import { useCreateTimeBlock } from '@/hooks';
import type { CalendarProfessional } from '@/types';

interface BlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  professionals: CalendarProfessional[];
  defaultProfessionalId: string | null;
  defaultTime: string | null;
  selectedDate: string;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function BlockTimeModal({
  isOpen,
  onClose,
  professionals,
  defaultProfessionalId,
  defaultTime,
  selectedDate,
}: BlockTimeModalProps) {
  const [professionalId, setProfessionalId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createTimeBlock = useCreateTimeBlock();

  useEffect(() => {
    if (isOpen) {
      setProfessionalId(defaultProfessionalId || (professionals.length > 0 ? professionals[0].id : ''));
      setStartTime(defaultTime || '09:00');
      setEndTime(defaultTime ? addMinutesToTime(defaultTime, 60) : '10:00');
      setReason('');
      setFormError(null);
    }
  }, [isOpen, defaultProfessionalId, defaultTime, professionals]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!professionalId) {
      setFormError('Selecione um profissional.');
      return;
    }

    if (!startTime || !endTime) {
      setFormError('Preencha os horarios de inicio e fim.');
      return;
    }

    if (startTime >= endTime) {
      setFormError('O horario de inicio deve ser anterior ao horario de fim.');
      return;
    }

    // Build ISO timestamps from selectedDate + time
    const startISO = `${selectedDate}T${startTime}:00`;
    const endISO = `${selectedDate}T${endTime}:00`;

    try {
      await createTimeBlock.mutateAsync({
        professionalId,
        startTime: startISO,
        endTime: endISO,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao criar o bloqueio.';
      setFormError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Bloquear Horario
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {formError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {formError}
            </div>
          )}

          {/* Professional select */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Profissional
            </label>
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Selecione...</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date (read-only display) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Data
            </label>
            <input
              type="text"
              readOnly
              value={new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-muted)] outline-none"
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Inicio
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Fim
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Motivo <span className="text-[var(--text-muted)]">(opcional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Almoco, Reuniao, Folga..."
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createTimeBlock.isPending}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {createTimeBlock.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Bloqueando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Bloquear
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
