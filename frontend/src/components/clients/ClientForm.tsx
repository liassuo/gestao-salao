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
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Erro ao salvar</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Nome *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Nome completo do cliente"
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.phone ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Observações
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Informações adicionais sobre o cliente (opcional)"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
