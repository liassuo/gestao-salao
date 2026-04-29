import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2, Camera, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useServices } from '@/hooks';
import type { Professional, CreateProfessionalPayload, WorkingHours } from '@/types';
import { weekDayShortLabels } from '@/types';
import { VacationsManager } from './VacationsManager';

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
      email: data.email,
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
              disabled={isEditing}
              className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.email ? 'border-[#A63030]' : 'border-[var(--border-color)]'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-[#A63030]">{errors.email.message}</p>
            )}
            {!isEditing && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                O profissional usará este email para fazer login no sistema.
              </p>
            )}
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

      {isEditing && professional && (
        <VacationsManager professionalId={professional.id} professionalName={professional.name} />
      )}

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
