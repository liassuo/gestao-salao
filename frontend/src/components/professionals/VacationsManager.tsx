import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { professionalsService } from '@/services/professionals';
import { useToast } from '@/components/ui';
import type { ProfessionalVacation } from '@/types';

interface VacationsManagerProps {
  professionalId: string;
  professionalName: string;
}

// "YYYY-MM-DD" -> "DD/MM/YYYY". Parse manual para evitar conversão de fuso.
function formatDateBR(iso: string): string {
  if (!iso) return '';
  const s = iso.length >= 10 ? iso.substring(0, 10) : iso;
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  // Hoje no fuso de Brasília — bate com o backend.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isOngoing(v: ProfessionalVacation): boolean {
  const t = todayISO();
  return v.startDate <= t && t <= v.endDate;
}

function isPast(v: ProfessionalVacation): boolean {
  return v.endDate < todayISO();
}

export function VacationsManager({ professionalId }: VacationsManagerProps) {
  const [vacations, setVacations] = useState<ProfessionalVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const refresh = async () => {
    try {
      const data = await professionalsService.listVacations(professionalId);
      setVacations(data);
    } catch {
      // silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setFormError(null);
  };

  const handleAdd = async () => {
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError('Preencha as duas datas.');
      return;
    }
    if (endDate < startDate) {
      setFormError('A data final deve ser igual ou posterior à inicial.');
      return;
    }
    setSubmitting(true);
    try {
      await professionalsService.createVacation(professionalId, {
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      toast.success('Férias cadastradas', 'O período foi adicionado.');
      resetForm();
      setAdding(false);
      await refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message || 'Erro ao salvar férias.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vacationId: string) => {
    if (!confirm('Remover este período de férias?')) return;
    setDeleting(vacationId);
    try {
      await professionalsService.deleteVacation(professionalId, vacationId);
      toast.success('Férias removidas', 'O período foi excluído.');
      await refresh();
    } catch {
      toast.error('Erro', 'Não foi possível remover.');
    } finally {
      setDeleting(null);
    }
  };

  const minDate = todayISO();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Férias
        </label>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-[#C8923A] hover:text-[#8B6914] transition-colors flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo período
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando férias...
          </div>
        ) : (
          <>
            {vacations.length === 0 && !adding && (
              <p className="text-xs text-[var(--text-muted)] py-1">
                Nenhuma férias cadastrada. As férias bloqueiam novos agendamentos no período.
              </p>
            )}

            {vacations.map((v) => {
              const ongoing = isOngoing(v);
              const past = isPast(v);
              return (
                <div
                  key={v.id}
                  className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 ${
                    ongoing
                      ? 'border-[#C8923A] bg-[#C8923A]/10'
                      : past
                      ? 'border-[var(--border-color)] bg-[var(--card-bg)] opacity-70'
                      : 'border-[var(--border-color)] bg-[var(--card-bg)]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {formatDateBR(v.startDate)} até {formatDateBR(v.endDate)}
                      {ongoing && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-[#C8923A] text-[#1c1006] px-1.5 py-0.5 rounded">
                          em férias
                        </span>
                      )}
                      {past && (
                        <span className="ml-2 text-[10px] font-medium uppercase text-[var(--text-muted)]">
                          encerrada
                        </span>
                      )}
                    </p>
                    {v.reason && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 break-words">
                        {v.reason}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    disabled={deleting === v.id}
                    className="flex-shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#A63030] hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Remover"
                  >
                    {deleting === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}

            {adding && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-3 space-y-3">
                {formError && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-[#A63030] flex-shrink-0" />
                    <p className="text-xs text-[#C45050]">{formError}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                      Início
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      min={minDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                      Volta
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || minDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Motivo (opcional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: viagem, descanso..."
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      resetForm();
                    }}
                    disabled={submitting}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-lg bg-[#8B6914] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#725510] transition-colors disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    {submitting ? 'Salvando...' : 'Salvar férias'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
