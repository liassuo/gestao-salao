import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Client, CreateClientPayload } from '@/types';

interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

interface ClientFormProps {
  client?: Client | null;
  onSubmit: (payload: CreateClientPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function ClientForm({ client, onSubmit, isLoading, error }: ClientFormProps) {
  const isEditing = !!client;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    defaultValues: {
      name: client?.name || '',
      phone: client?.phone || '',
      email: client?.email || '',
      notes: client?.notes || '',
    },
  });

  const handleFormSubmit = async (data: ClientFormData) => {
    await onSubmit({
      name: data.name,
      phone: data.phone.replace(/\D/g, ''),
      email: data.email || undefined,
      notes: data.notes || undefined,
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
          Nome *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Nome completo do cliente"
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
          Observações
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Informações adicionais sobre o cliente (opcional)"
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
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
