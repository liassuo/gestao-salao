import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { SubscriptionPlan, CreatePlanPayload } from '@/types';

interface PlanFormData {
  name: string;
  description: string;
  price: string;
  cutsPerMonth: number;
}

interface SubscriptionPlanFormProps {
  plan?: SubscriptionPlan | null;
  onSubmit: (payload: CreatePlanPayload) => Promise<void>;
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

export function SubscriptionPlanForm({ plan, onSubmit, isLoading, error }: SubscriptionPlanFormProps) {
  const isEditing = !!plan;

  const [priceDisplay, setPriceDisplay] = useState(() => {
    if (plan?.price) {
      return formatCurrencyInput(String(plan.price));
    }
    return '';
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PlanFormData>({
    defaultValues: {
      name: plan?.name || '',
      description: plan?.description || '',
      price: plan?.price ? String(plan.price) : '',
      cutsPerMonth: plan?.cutsPerMonth || 4,
    },
  });

  useEffect(() => {
    if (plan?.price) {
      setPriceDisplay(formatCurrencyInput(String(plan.price)));
    }
  }, [plan?.price]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setPriceDisplay(formatted);
    setValue('price', e.target.value.replace(/\D/g, ''));
  };

  const handleFormSubmit = async (data: PlanFormData) => {
    const priceInCents = parseCurrencyInput(data.price);

    await onSubmit({
      name: data.name,
      description: data.description || undefined,
      price: priceInCents,
      cutsPerMonth: data.cutsPerMonth,
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
          Nome do Plano *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Ex: Plano Mensal"
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
          Descricao
        </label>
        <textarea
          {...register('description')}
          rows={2}
          placeholder="Descricao do plano (opcional)"
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Preco Mensal *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              R$
            </span>
            <input
              type="text"
              value={priceDisplay}
              onChange={handlePriceChange}
              placeholder="0,00"
              className={`w-full rounded-xl border bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.price ? 'border-red-500' : 'border-[var(--border-color)]'
              }`}
            />
            <input type="hidden" {...register('price', { required: 'Preco é obrigatório' })} />
          </div>
          {errors.price && (
            <p className="mt-1 text-sm text-red-500">{errors.price.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Cortes por Mes *
          </label>
          <select
            {...register('cutsPerMonth', { required: 'Quantidade é obrigatória', valueAsNumber: true })}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.cutsPerMonth ? 'border-red-500' : 'border-[var(--border-color)]'
            }`}
          >
            <option value={1}>1 corte</option>
            <option value={2}>2 cortes</option>
            <option value={3}>3 cortes</option>
            <option value={4}>4 cortes</option>
            <option value={5}>5 cortes</option>
            <option value={6}>6 cortes</option>
            <option value={8}>8 cortes</option>
            <option value={10}>10 cortes</option>
            <option value={99}>Ilimitado</option>
          </select>
          {errors.cutsPerMonth && (
            <p className="mt-1 text-sm text-red-500">{errors.cutsPerMonth.message}</p>
          )}
        </div>
      </div>

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
