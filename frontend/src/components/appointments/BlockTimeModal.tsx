import { useState, useEffect } from 'react';
import { X, Lock, Coffee, Loader2 } from 'lucide-react';
import { useCreateTimeBlock, useCreateTimeBlockRange } from '@/hooks';
import type { CalendarProfessional } from '@/types';

export type BlockTimeModalMode = 'BLOCK' | 'BREAK';

interface BlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  professionals: CalendarProfessional[];
  defaultProfessionalId: string | null;
  defaultTime: string | null;
  selectedDate: string;
  mode?: BlockTimeModalMode;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

const COPY: Record<BlockTimeModalMode, {
  title: string;
  Icon: typeof Lock;
  iconColor: string;
  borderColor: string;
  hoverBg: string;
  buttonBg: string;
  buttonHover: string;
  submitLabel: string;
  submitLoading: string;
  reasonPlaceholder: string;
  errorPrefix: string;
}> = {
  BLOCK: {
    title: 'Bloquear Horário',
    Icon: Lock,
    iconColor: 'text-[#C45050]',
    borderColor: 'border-[#A63030]/30',
    hoverBg: 'hover:bg-red-500/10',
    buttonBg: 'bg-[#8B2020]',
    buttonHover: 'hover:bg-[#6B1818]',
    submitLabel: 'Bloquear',
    submitLoading: 'Bloqueando...',
    reasonPlaceholder: 'Ex: Folga, Ferias, Reuniao...',
    errorPrefix: 'Ocorreu um erro ao criar o bloqueio.',
  },
  BREAK: {
    title: 'Adicionar Intervalo',
    Icon: Coffee,
    iconColor: 'text-[#C8923A]',
    borderColor: 'border-[#C8923A]/30',
    hoverBg: 'hover:bg-amber-500/10',
    buttonBg: 'bg-[#A8751F]',
    buttonHover: 'hover:bg-[#8B5F18]',
    submitLabel: 'Adicionar',
    submitLoading: 'Adicionando...',
    reasonPlaceholder: 'Ex: Almoco, Cafe, Pausa...',
    errorPrefix: 'Ocorreu um erro ao adicionar o intervalo.',
  },
};

export function BlockTimeModal({
  isOpen,
  onClose,
  professionals,
  defaultProfessionalId,
  defaultTime,
  selectedDate,
  mode = 'BLOCK',
}: BlockTimeModalProps) {
  const copy = COPY[mode];

  const [professionalId, setProfessionalId] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createTimeBlock = useCreateTimeBlock();
  const createTimeBlockRange = useCreateTimeBlockRange();
  const isPending = createTimeBlock.isPending || createTimeBlockRange.isPending;

  useEffect(() => {
    if (isOpen) {
      setProfessionalId(defaultProfessionalId || (professionals.length > 0 ? professionals[0].id : ''));
      setMultiDay(false);
      setStartDate(selectedDate);
      setEndDate(selectedDate);
      setAllDay(false);
      // Para intervalo, default mais curto (30 min); para bloqueio, 60 min
      const span = mode === 'BREAK' ? 30 : 60;
      const initial = defaultTime || (mode === 'BREAK' ? '12:00' : '09:00');
      setStartTime(initial);
      setEndTime(addMinutesToTime(initial, span));
      setReason('');
      setFormError(null);
    }
  }, [isOpen, defaultProfessionalId, defaultTime, professionals, selectedDate, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!professionalId) {
      setFormError('Selecione um profissional.');
      return;
    }

    if (multiDay) {
      if (!startDate || !endDate) {
        setFormError('Preencha as datas de início e fim.');
        return;
      }
      if (endDate < startDate) {
        setFormError('A data de fim deve ser igual ou posterior à de início.');
        return;
      }
      if (!allDay) {
        if (!startTime || !endTime) {
          setFormError('Preencha os horários ou marque "Dia inteiro".');
          return;
        }
        if (startTime >= endTime) {
          setFormError('O horário de início deve ser anterior ao de fim.');
          return;
        }
      }

      try {
        await createTimeBlockRange.mutateAsync({
          professionalId,
          startDate,
          endDate,
          startTime: allDay ? undefined : startTime,
          endTime: allDay ? undefined : endTime,
          allDay,
          reason: reason.trim() || undefined,
        });
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : copy.errorPrefix;
        setFormError(message);
      }
      return;
    }

    // Single day
    if (allDay) {
      // Even single-day, allDay is supported via the range endpoint
      try {
        await createTimeBlockRange.mutateAsync({
          professionalId,
          startDate: selectedDate,
          endDate: selectedDate,
          allDay: true,
          reason: reason.trim() || undefined,
        });
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : copy.errorPrefix;
        setFormError(message);
      }
      return;
    }

    if (!startTime || !endTime) {
      setFormError('Preencha os horários de início e fim.');
      return;
    }
    if (startTime >= endTime) {
      setFormError('O horário de início deve ser anterior ao de fim.');
      return;
    }

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
      const message = err instanceof Error ? err.message : copy.errorPrefix;
      setFormError(message);
    }
  };

  const Icon = copy.Icon;

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
            <Icon className={`h-5 w-5 ${copy.iconColor}`} />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {copy.title}
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
            <div className="rounded-lg border border-[#A63030]/30 bg-red-500/10 px-3 py-2 text-sm text-[#C45050]">
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
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A]"
            >
              <option value="">Selecione...</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-1">
            <button
              type="button"
              onClick={() => setMultiDay(false)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                !multiDay
                  ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Apenas hoje
            </button>
            <button
              type="button"
              onClick={() => setMultiDay(true)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                multiDay
                  ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Vários dias
            </button>
          </div>

          {/* Date(s) */}
          {!multiDay ? (
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
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  De
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Até
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A]"
                />
              </div>
            </div>
          )}

          {/* All day toggle */}
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-color)] accent-[#C8923A]"
            />
            Dia inteiro
          </label>

          {/* Time range — só quando não é dia inteiro */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Início
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A]"
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
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A]"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Motivo <span className="text-[var(--text-muted)]">(opcional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={copy.reasonPlaceholder}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A]"
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
              disabled={isPending}
              className={`flex items-center gap-2 rounded-lg ${copy.buttonBg} px-4 py-2 text-sm font-medium text-white transition-colors ${copy.buttonHover} disabled:opacity-50`}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.submitLoading}
                </>
              ) : (
                <>
                  <Icon className="h-4 w-4" />
                  {copy.submitLabel}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
