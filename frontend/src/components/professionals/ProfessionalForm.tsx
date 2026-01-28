import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Professional, CreateProfessionalPayload, WorkingHours } from '@/types';

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

  const handleFormSubmit = async (data: ProfessionalFormData) => {
    await onSubmit({
      name: data.name,
      phone: data.phone.replace(/\D/g, ''),
      email: data.email || undefined,
      commissionRate: data.commissionRate ? parseFloat(data.commissionRate) : undefined,
      workingHours: isEditing ? undefined : DEFAULT_WORKING_HOURS,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
          <div>
            <p className="font-medium text-red-500">Erro ao salvar</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Nome *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Nome completo do profissional"
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
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
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.phone ? 'border-red-500' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
        )}
      </div>

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
          placeholder="email@exemplo.com (opcional)"
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
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
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.commissionRate ? 'border-red-500' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.commissionRate && (
          <p className="mt-1 text-sm text-red-500">{errors.commissionRate.message}</p>
        )}
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Percentual de comissão sobre os serviços realizados
        </p>
      </div>

      {!isEditing && (
        <div className="rounded-xl bg-[var(--hover-bg)] p-4">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Horário de Trabalho Padrão</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Seg-Sex: 09:00 às 18:00 | Sáb: 09:00 às 14:00
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)] opacity-70">
            Você pode ajustar os horários depois de criar o profissional.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
