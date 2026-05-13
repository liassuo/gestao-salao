import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2, Camera, Check, Coffee, X } from 'lucide-react';
import { api } from '@/services/api';
import { useServices } from '@/hooks';
import { useToast } from '@/components/ui/ToastContext';
import type { Professional, CreateProfessionalPayload, WorkingHours } from '@/types';
import { weekDayShortLabels } from '@/types';

interface RecurringBreakRow {
  uid: string;
  label: string;
  startTime: string;
  endTime: string;
  days: number[]; // dayOfWeek selecionados
}

function makeUid(): string {
  return `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractBreaksFromWorkingHours(workingHours: WorkingHours[] | null | undefined): RecurringBreakRow[] {
  if (!workingHours) return [];
  const map = new Map<string, RecurringBreakRow>();
  for (const wh of workingHours) {
    for (const br of wh.breaks || []) {
      const key = `${br.startTime}|${br.endTime}|${br.label || ''}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.days.includes(wh.dayOfWeek)) existing.days.push(wh.dayOfWeek);
      } else {
        map.set(key, {
          uid: makeUid(),
          label: br.label || '',
          startTime: br.startTime,
          endTime: br.endTime,
          days: [wh.dayOfWeek],
        });
      }
    }
  }
  return Array.from(map.values());
}

interface ProfessionalFormData {
  name: string;
  email: string;
  commissionRate: string;
}

interface ProfessionalFormProps {
  professional?: Professional | null;
  onSubmit: (payload: CreateProfessionalPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' },
];

export function ProfessionalForm({ professional, onSubmit, isLoading, error }: ProfessionalFormProps) {
  const isEditing = !!professional;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(professional?.avatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    professional?.services?.map((s) => s.id) || []
  );
  const { data: allServices } = useServices();

  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(() => {
    const initial = professional?.workingHours && professional.workingHours.length > 0
      ? professional.workingHours
      : DEFAULT_WORKING_HOURS;
    // Remove breaks da estrutura — gerenciadas separadamente em recurringBreaks
    return initial.map(({ breaks: _b, ...rest }) => rest);
  });

  const [recurringBreaks, setRecurringBreaks] = useState<RecurringBreakRow[]>(
    () => extractBreaksFromWorkingHours(professional?.workingHours || null)
  );

  const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Seg a Dom

  const isDayActive = (day: number) => workingHours.some((wh) => wh.dayOfWeek === day);
  const activeDays = workingHours.map((wh) => wh.dayOfWeek);

  const toggleDay = (day: number) => {
    if (isDayActive(day)) {
      setWorkingHours((prev) => prev.filter((wh) => wh.dayOfWeek !== day));
      // Remove o dia de qualquer intervalo que o referenciava
      setRecurringBreaks((prev) =>
        prev.map((b) => ({ ...b, days: b.days.filter((d) => d !== day) }))
      );
    } else {
      setWorkingHours((prev) => [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '18:00' }]);
    }
  };

  const updateDayTime = (day: number, field: 'startTime' | 'endTime', value: string) => {
    setWorkingHours((prev) =>
      prev.map((wh) => (wh.dayOfWeek === day ? { ...wh, [field]: value } : wh))
    );
  };

  const addRecurringBreak = () => {
    setRecurringBreaks((prev) => [
      ...prev,
      {
        uid: makeUid(),
        label: 'Almoço',
        startTime: '12:00',
        endTime: '13:00',
        days: [...activeDays].sort(),
      },
    ]);
  };

  const updateRecurringBreak = (uid: string, field: 'label' | 'startTime' | 'endTime', value: string) => {
    setRecurringBreaks((prev) =>
      prev.map((b) => (b.uid === uid ? { ...b, [field]: value } : b))
    );
  };

  const toggleBreakDay = (uid: string, day: number) => {
    setRecurringBreaks((prev) =>
      prev.map((b) => {
        if (b.uid !== uid) return b;
        const has = b.days.includes(day);
        return { ...b, days: has ? b.days.filter((d) => d !== day) : [...b.days, day].sort() };
      })
    );
  };

  const removeRecurringBreak = (uid: string) => {
    setRecurringBreaks((prev) => prev.filter((b) => b.uid !== uid));
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfessionalFormData>({
    defaultValues: {
      name: professional?.name || '',
      email: professional?.email || '',
      commissionRate: professional?.commissionRate?.toString() || '',
    },
  });

  const toast = useToast();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo inválido', 'Selecione uma imagem (PNG, JPG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande', 'Limite de 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ url: string }>('/professionals/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data.url);
      toast.success('Foto enviada', 'Salve o profissional para confirmar');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Tente novamente';
      toast.error('Falha ao enviar foto', msg);
    } finally {
      setUploading(false);
      // permite re-selecionar o mesmo arquivo após erro
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleFormSubmit = async (data: ProfessionalFormData) => {
    // Valida intervalos antes de enviar
    for (const br of recurringBreaks) {
      if (!br.startTime || !br.endTime || br.startTime >= br.endTime) {
        toast.error('Intervalo inválido', `Verifique os horários do intervalo "${br.label || 'sem nome'}"`);
        return;
      }
      if (br.days.length === 0) {
        toast.error('Intervalo sem dias', `Selecione pelo menos um dia para o intervalo "${br.label || 'sem nome'}"`);
        return;
      }
    }

    // Merge recurringBreaks de volta em workingHours por dia
    const mergedWorkingHours: WorkingHours[] = workingHours.map((wh) => {
      const dayBreaks = recurringBreaks
        .filter((b) => b.days.includes(wh.dayOfWeek) && b.startTime && b.endTime && b.startTime < b.endTime)
        .map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
          ...(b.label.trim() ? { label: b.label.trim() } : {}),
        }));
      return dayBreaks.length > 0 ? { ...wh, breaks: dayBreaks } : { ...wh, breaks: undefined };
    });

    await onSubmit({
      name: data.name,
      email: data.email,
      // Em edição preservamos null (sinal de "remover foto"). Em criação, null vira undefined.
      avatarUrl: isEditing ? avatarUrl : (avatarUrl || undefined),
      commissionRate: data.commissionRate ? parseFloat(data.commissionRate) : undefined,
      serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
      workingHours: mergedWorkingHours,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[#A63030]" />
          <div>
            <p className="font-medium text-[#A63030]">Erro ao salvar</p>
            <p className="text-sm text-[#C45050]">{error}</p>
          </div>
        </div>
      )}

      {/* Foto + Nome + Comissão */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative w-16 h-16 rounded-full border-2 border-dashed border-[var(--border-color)] flex items-center justify-center overflow-hidden transition-all ${
              uploading ? 'opacity-50' : 'cursor-pointer hover:border-[#C8923A]'
            }`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-5 w-5 text-[var(--text-muted)]" />
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </div>
            )}
          </div>
          {avatarUrl && !uploading && (
            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              className="mt-1 w-full text-center text-[10px] text-[var(--text-muted)] hover:text-[#A63030] transition-colors"
            >
              Remover
            </button>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Nome *
              </label>
              <input
                type="text"
                {...register('name', { required: 'Nome é obrigatório' })}
                placeholder="Nome do profissional"
                className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
                  errors.name ? 'border-[#A63030]' : 'border-[var(--border-color)]'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-[#A63030]">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Comissão (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register('commissionRate', {
                  min: { value: 0, message: 'Mínimo 0%' },
                  max: { value: 100, message: 'Máximo 100%' },
                })}
                placeholder="Ex: 50"
                className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
                  errors.commissionRate ? 'border-[#A63030]' : 'border-[var(--border-color)]'
                }`}
              />
              {errors.commissionRate && (
                <p className="mt-1 text-sm text-[#A63030]">{errors.commissionRate.message}</p>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Email * (usado para login)
            </label>
            <input
              type="email"
              {...register('email', {
                required: 'Email é obrigatório',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' },
              })}
              placeholder="email@exemplo.com"
              className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
                errors.email ? 'border-[#A63030]' : 'border-[var(--border-color)]'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-[#A63030]">{errors.email.message}</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {isEditing
                ? 'Alterar este email muda o login do profissional no sistema.'
                : 'O profissional usará este email para fazer login no sistema.'}
            </p>
          </div>
        </div>
      </div>

      {/* Serviços - largura total */}
      {allServices && allServices.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Serviços
            </label>
            <button
              type="button"
              onClick={() => {
                const allIds = allServices!.map((s) => s.id);
                const allSelected = allIds.every((id) => selectedServiceIds.includes(id));
                setSelectedServiceIds(allSelected ? [] : allIds);
              }}
              className="text-xs font-medium text-[#C8923A] hover:text-[#8B6914] transition-colors"
            >
              {allServices!.every((s) => selectedServiceIds.includes(s.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allServices.map((service) => {
              const isSelected = selectedServiceIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#C8923A] text-white'
                      : 'bg-[var(--hover-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[#C8923A]'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  {service.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dias de Trabalho - grade compacta */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
          Dias de Trabalho
        </label>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] overflow-hidden">
          {ALL_DAYS.map((day, idx) => {
            const active = isDayActive(day);
            const wh = workingHours.find((w) => w.dayOfWeek === day);
            return (
              <div
                key={day}
                className={`flex items-center gap-3 px-3 py-2 ${
                  idx < ALL_DAYS.length - 1 ? 'border-b border-[var(--border-color)]' : ''
                } ${active ? '' : 'opacity-50'}`}
              >
                <button
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                    active ? 'border-[#C8923A] bg-[#C8923A]' : 'border-[var(--border-color)] hover:border-[#C8923A]'
                  }`}
                >
                  {active && <Check className="h-3 w-3 text-white" />}
                </button>
                <span className={`w-10 text-sm font-medium ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {weekDayShortLabels[day]}
                </span>
                {active && wh ? (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="time"
                      value={wh.startTime}
                      onChange={(e) => updateDayTime(day, 'startTime', e.target.value)}
                      className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#C8923A] w-[80px]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                    <input
                      type="time"
                      value={wh.endTime}
                      onChange={(e) => updateDayTime(day, 'endTime', e.target.value)}
                      className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#C8923A] w-[80px]"
                    />
                  </div>
                ) : (
                  <span className="ml-auto text-xs text-[var(--text-muted)]">Folga</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Intervalos Fixos */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              Intervalos fixos
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Aplicados automaticamente nos dias selecionados (ex: almoço). Para pausas pontuais, use o botão "Intervalo" no calendário.
            </p>
          </div>
          <button
            type="button"
            onClick={addRecurringBreak}
            disabled={activeDays.length === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#C8923A]/40 bg-[#C8923A]/10 px-3 py-1.5 text-xs font-medium text-[#C8923A] transition-colors hover:bg-[#C8923A]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Coffee className="h-3.5 w-3.5" />
            Adicionar intervalo
          </button>
        </div>

        {recurringBreaks.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--hover-bg)]/50 px-4 py-6 text-center">
            <div>
              <Coffee className="mx-auto mb-1.5 h-5 w-5 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Nenhum intervalo fixo cadastrado</p>
              <p className="text-xs text-[var(--text-muted)]">Cadastre, por exemplo, o horário de almoço</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recurringBreaks.map((br) => {
              const invalid = br.startTime && br.endTime && br.startTime >= br.endTime;
              const noDays = br.days.length === 0;
              return (
                <div
                  key={br.uid}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Coffee className="h-4 w-4 shrink-0 text-[#C8923A]" />
                    <input
                      type="text"
                      value={br.label}
                      onChange={(e) => updateRecurringBreak(br.uid, 'label', e.target.value)}
                      placeholder="Nome (ex: Almoço)"
                      className="min-w-[120px] flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={br.startTime}
                        onChange={(e) => updateRecurringBreak(br.uid, 'startTime', e.target.value)}
                        className={`rounded-lg border bg-[var(--card-bg)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#C8923A] ${
                          invalid ? 'border-[#A63030]' : 'border-[var(--border-color)]'
                        }`}
                      />
                      <span className="text-xs text-[var(--text-muted)]">até</span>
                      <input
                        type="time"
                        value={br.endTime}
                        onChange={(e) => updateRecurringBreak(br.uid, 'endTime', e.target.value)}
                        className={`rounded-lg border bg-[var(--card-bg)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#C8923A] ${
                          invalid ? 'border-[#A63030]' : 'border-[var(--border-color)]'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRecurringBreak(br.uid)}
                      className="ml-auto shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-[#A63030]"
                      title="Remover intervalo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Aplicar em:
                    </span>
                    {ALL_DAYS.map((day) => {
                      const dayActive = isDayActive(day);
                      const selected = br.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!dayActive}
                          onClick={() => toggleBreakDay(br.uid, day)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            selected
                              ? 'bg-[#C8923A] text-white'
                              : dayActive
                              ? 'border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:border-[#C8923A]'
                              : 'cursor-not-allowed border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-muted)] opacity-40'
                          }`}
                          title={dayActive ? '' : 'Profissional não trabalha neste dia'}
                        >
                          {weekDayShortLabels[day]}
                        </button>
                      );
                    })}
                  </div>

                  {(invalid || noDays) && (
                    <p className="mt-2 text-xs text-[#A63030]">
                      {invalid && 'O horário de início deve ser anterior ao de fim. '}
                      {noDays && 'Selecione pelo menos um dia da semana.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
