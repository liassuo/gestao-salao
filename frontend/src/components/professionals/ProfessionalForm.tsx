import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2, Camera, X, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useServices } from '@/hooks';
import type { Professional, CreateProfessionalPayload, WorkingHours } from '@/types';
import { weekDayShortLabels } from '@/types';

interface ProfessionalFormData {
  name: string;
  phone: string;
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

  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(
    professional?.workingHours && professional.workingHours.length > 0
      ? professional.workingHours
      : DEFAULT_WORKING_HOURS
  );

  const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Seg a Dom

  const isDayActive = (day: number) => workingHours.some((wh) => wh.dayOfWeek === day);

  const toggleDay = (day: number) => {
    if (isDayActive(day)) {
      setWorkingHours((prev) => prev.filter((wh) => wh.dayOfWeek !== day));
    } else {
      setWorkingHours((prev) => [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '18:00' }]);
    }
  };

  const updateDayTime = (day: number, field: 'startTime' | 'endTime', value: string) => {
    setWorkingHours((prev) =>
      prev.map((wh) => (wh.dayOfWeek === day ? { ...wh, [field]: value } : wh))
    );
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfessionalFormData>({
    defaultValues: {
      name: professional?.name || '',
      phone: professional?.phone || '',
      email: professional?.email || '',
      commissionRate: professional?.commissionRate?.toString() || '',
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ url: string }>('/professionals/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data.url);
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleFormSubmit = async (data: ProfessionalFormData) => {
    await onSubmit({
      name: data.name,
      phone: data.phone.replace(/\D/g, ''),
      email: data.email || undefined,
      avatarUrl: avatarUrl || undefined,
      commissionRate: data.commissionRate ? parseFloat(data.commissionRate) : undefined,
      serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
      workingHours,
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

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Foto de Perfil
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] transition-all ${
            uploading ? 'opacity-50' : 'cursor-pointer hover:border-[#C8923A]'
          }`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Preview" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--border-color)] flex items-center justify-center flex-shrink-0">
              <Camera className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm text-[var(--text-muted)]">
              {uploading ? 'Enviando...' : avatarUrl ? 'Clique para trocar a foto' : 'Clique para selecionar uma foto'}
            </span>
          </div>
          {uploading && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)] flex-shrink-0" />
          )}
          {avatarUrl && !uploading && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAvatarUrl(null); }}
              className="p-1 text-[var(--text-muted)] hover:text-[#A63030] transition-colors flex-shrink-0"
              title="Remover foto"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Nome *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Nome completo do profissional"
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
            errors.name ? 'border-[#A63030]' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-[#A63030]">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Telefone *
        </label>
        <input
          type="tel"
          {...register('phone', {
            required: 'Telefone é obrigatório',
            pattern: {
              value: /^[\d\s()-]+$/,
              message: 'Telefone inválido',
            },
          })}
          placeholder="(11) 99999-9999"
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
            errors.phone ? 'border-[#A63030]' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-[#A63030]">{errors.phone.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            E-mail
          </label>
          <input
            type="email"
            {...register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'E-mail inválido',
              },
            })}
            placeholder="email@exemplo.com"
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
              errors.email ? 'border-[#A63030]' : 'border-[var(--border-color)]'
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-[#A63030]">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
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

      <div className="grid grid-cols-2 gap-4">
        {allServices && allServices.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Serviços
            </label>
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

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Dias de Trabalho
          </label>
          <div className="space-y-1.5">
            {ALL_DAYS.map((day) => {
              const active = isDayActive(day);
              const wh = workingHours.find((w) => w.dayOfWeek === day);
              return (
                <div key={day} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                      active ? 'border-[#C8923A] bg-[#C8923A]' : 'border-[var(--border-color)]'
                    }`}
                  >
                    {active && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                  <span className={`w-8 text-xs font-medium ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                    {weekDayShortLabels[day]}
                  </span>
                  {active && wh ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={wh.startTime}
                        onChange={(e) => updateDayTime(day, 'startTime', e.target.value)}
                        className="rounded border border-[var(--border-color)] bg-[var(--hover-bg)] px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#C8923A] w-[72px]"
                      />
                      <span className="text-[10px] text-[var(--text-muted)]">-</span>
                      <input
                        type="time"
                        value={wh.endTime}
                        onChange={(e) => updateDayTime(day, 'endTime', e.target.value)}
                        className="rounded border border-[var(--border-color)] bg-[var(--hover-bg)] px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#C8923A] w-[72px]"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">Folga</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
