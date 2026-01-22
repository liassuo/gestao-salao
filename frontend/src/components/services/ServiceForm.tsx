import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Service, CreateServicePayload } from '@/types';

interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration: number;
}

interface ServiceFormProps {
  service?: Service | null;
  onSubmit: (payload: CreateServicePayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const cents = parseInt(numbers, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value: string): number {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers, 10) || 0;
}

export function ServiceForm({ service, onSubmit, isLoading, error }: ServiceFormProps) {
  const isEditing = !!service;

  const [priceDisplay, setPriceDisplay] = useState(() => {
    if (service?.price) {
      return formatCurrencyInput(String(service.price));
    }
    return '';
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: {
      name: service?.name || '',
      description: service?.description || '',
      price: service?.price ? String(service.price) : '',
      duration: service?.duration || 30,
    },
  });

  useEffect(() => {
    if (service?.price) {
      setPriceDisplay(formatCurrencyInput(String(service.price)));
    }
  }, [service?.price]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setPriceDisplay(formatted);
    setValue('price', e.target.value.replace(/\D/g, ''));
  };

  const handleFormSubmit = async (data: ServiceFormData) => {
    const priceInCents = parseCurrencyInput(data.price);

    await onSubmit({
      name: data.name,
      description: data.description || undefined,
      price: priceInCents,
      duration: data.duration,
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
          Nome do Serviço *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Ex: Corte de Cabelo"
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Descrição
        </label>
        <textarea
          {...register('description')}
          rows={2}
          placeholder="Descrição do serviço (opcional)"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Preço *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              R$
            </span>
            <input
              type="text"
              value={priceDisplay}
              onChange={handlePriceChange}
              placeholder="0,00"
              className={`w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.price ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <input type="hidden" {...register('price', { required: 'Preço é obrigatório' })} />
          </div>
          {errors.price && (
            <p className="mt-1 text-sm text-red-500">{errors.price.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Duração (minutos) *
          </label>
          <select
            {...register('duration', { required: 'Duração é obrigatória', valueAsNumber: true })}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.duration ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value={15}>15 minutos</option>
            <option value={20}>20 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={45}>45 minutos</option>
            <option value={60}>1 hora</option>
            <option value={90}>1h 30min</option>
            <option value={120}>2 horas</option>
          </select>
          {errors.duration && (
            <p className="mt-1 text-sm text-red-500">{errors.duration.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
