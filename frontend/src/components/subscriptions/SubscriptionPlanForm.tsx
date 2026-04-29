import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useServices } from '@/hooks';
import type { SubscriptionPlan, CreatePlanPayload, PlanServicePayload } from '@/types';

interface PlanFormData {
  name: string;
  description: string;
  price: string;
  cutsPerMonth: number;
  discountPercent: number;
}

interface SubscriptionPlanFormProps {
  plan?: SubscriptionPlan | null;
  onSubmit: (payload: CreatePlanPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

interface ServiceDiscountRow {
  serviceId: string;
  discountPercent: number;
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

function formatPriceLabel(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SubscriptionPlanForm({ plan, onSubmit, isLoading, error }: SubscriptionPlanFormProps) {
  const isEditing = !!plan;

  const { data: services } = useServices();
  const activeServices = useMemo(
    () => (services || []).filter((s) => s.isActive !== false),
    [services],
  );

  const [priceDisplay, setPriceDisplay] = useState(() => {
    if (plan?.price) {
      return formatCurrencyInput(String(plan.price));
    }
    return '';
  });

  const [serviceRows, setServiceRows] = useState<ServiceDiscountRow[]>(() =>
    (plan?.services || []).map((s) => ({
      serviceId: s.serviceId,
      discountPercent: s.discountPercent,
    })),
  );

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
      discountPercent: plan?.discountPercent ?? 0,
    },
  });

  useEffect(() => {
    if (plan?.price) {
      setPriceDisplay(formatCurrencyInput(String(plan.price)));
    }
  }, [plan?.price]);

  useEffect(() => {
    if (plan?.services) {
      setServiceRows(
        plan.services.map((s) => ({
          serviceId: s.serviceId,
          discountPercent: s.discountPercent,
        })),
      );
    }
  }, [plan?.services]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setPriceDisplay(formatted);
    setValue('price', e.target.value.replace(/\D/g, ''));
  };

  const usedServiceIds = useMemo(() => new Set(serviceRows.map((r) => r.serviceId)), [serviceRows]);
  const availableServices = useMemo(
    () => activeServices.filter((s) => !usedServiceIds.has(s.id)),
    [activeServices, usedServiceIds],
  );

  const handleAddServiceRow = () => {
    if (availableServices.length === 0) return;
    setServiceRows((prev) => [
      ...prev,
      { serviceId: availableServices[0].id, discountPercent: 0 },
    ]);
  };

  const handleRemoveServiceRow = (index: number) => {
    setServiceRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, serviceId: string) => {
    setServiceRows((prev) => prev.map((r, i) => (i === index ? { ...r, serviceId } : r)));
  };

  const handleServiceDiscountChange = (index: number, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value || 0)));
    setServiceRows((prev) => prev.map((r, i) => (i === index ? { ...r, discountPercent: clamped } : r)));
  };

  const handleFormSubmit = async (data: PlanFormData) => {
    const priceInCents = parseCurrencyInput(data.price);

    // Filtra linhas inválidas (sem serviceId)
    const validServices: PlanServicePayload[] = serviceRows
      .filter((r) => r.serviceId)
      .map((r) => ({ serviceId: r.serviceId, discountPercent: r.discountPercent }));

    await onSubmit({
      name: data.name,
      description: data.description || undefined,
      price: priceInCents,
      cutsPerMonth: data.cutsPerMonth,
      discountPercent: Number.isFinite(data.discountPercent) ? data.discountPercent : 0,
      services: validServices,
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
          Nome do Plano *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Ex: Plano Mensal"
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
          Descrição
        </label>
        <textarea
          {...register('description')}
          rows={2}
          placeholder="Descrição do plano (opcional)"
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Preço Mensal *
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
              className={`w-full rounded-xl border bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
                errors.price ? 'border-[#A63030]' : 'border-[var(--border-color)]'
              }`}
            />
            <input type="hidden" {...register('price', { required: 'Preço é obrigatório' })} />
          </div>
          {errors.price && (
            <p className="mt-1 text-sm text-[#A63030]">{errors.price.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Cortes por Mês *
          </label>
          <select
            {...register('cutsPerMonth', { required: 'Quantidade é obrigatória', valueAsNumber: true })}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
              errors.cutsPerMonth ? 'border-[#A63030]' : 'border-[var(--border-color)]'
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
            <p className="mt-1 text-sm text-[#A63030]">{errors.cutsPerMonth.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Desconto geral (%)
          </label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              {...register('discountPercent', {
                valueAsNumber: true,
                min: { value: 0, message: 'Mínimo 0%' },
                max: { value: 100, message: 'Máximo 100%' },
              })}
              placeholder="0"
              className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 pr-9 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
                errors.discountPercent ? 'border-[#A63030]' : 'border-[var(--border-color)]'
              }`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
              %
            </span>
          </div>
          {errors.discountPercent && (
            <p className="mt-1 text-sm text-[#A63030]">{errors.discountPercent.message}</p>
          )}
        </div>
      </div>
      <p className="-mt-2 text-xs text-[var(--text-muted)]">
        O desconto geral é aplicado em produtos e em serviços que NÃO estiverem listados abaixo. Quando houver promoção ativa, prevalece o maior desconto.
      </p>

      {/* Serviços com desconto específico */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            Serviços com desconto específico
          </label>
          <button
            type="button"
            onClick={handleAddServiceRow}
            disabled={availableServices.length === 0}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-border)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar serviço
          </button>
        </div>
        <p className="mb-2 text-xs text-[var(--text-muted)]">
          Define um % de desconto específico por serviço. Sobrescreve o desconto geral acima quando o cliente fizer esse serviço.
        </p>

        {serviceRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--hover-bg)]/50 px-4 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum serviço com desconto específico.
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              O desconto geral será aplicado em todos os serviços.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {serviceRows.map((row, index) => {
              const selectedService = activeServices.find((s) => s.id === row.serviceId);
              const discountedPriceCents = selectedService
                ? Math.round((selectedService.price * (100 - row.discountPercent)) / 100)
                : 0;
              const savedCents = selectedService
                ? selectedService.price - discountedPriceCents
                : 0;

              return (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3 md:grid-cols-[1fr_120px_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Serviço
                    </label>
                    <select
                      value={row.serviceId}
                      onChange={(e) => handleServiceChange(index, e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
                    >
                      {selectedService && (
                        <option value={selectedService.id}>
                          {selectedService.name} — {formatPriceLabel(selectedService.price)}
                        </option>
                      )}
                      {availableServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {formatPriceLabel(s.price)}
                        </option>
                      ))}
                    </select>
                    {selectedService && row.discountPercent > 0 && (
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                        <span className="line-through">{formatPriceLabel(selectedService.price)}</span>
                        {' → '}
                        <span className="font-semibold text-[#C8923A]">
                          {formatPriceLabel(discountedPriceCents)}
                        </span>
                        <span className="ml-1 text-emerald-500">
                          (economia de {formatPriceLabel(savedCents)})
                        </span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Desconto
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.discountPercent}
                        onChange={(e) =>
                          handleServiceDiscountChange(index, parseInt(e.target.value, 10))
                        }
                        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-2 pr-7 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                        %
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveServiceRow(index)}
                    className="flex h-9 items-center justify-center gap-1 rounded-lg border border-[#A63030]/30 px-3 text-sm font-medium text-[#A63030] hover:bg-red-500/10 md:mt-5"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="md:hidden">Remover</span>
                  </button>
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
