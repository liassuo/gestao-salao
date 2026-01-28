import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useClients, useProfessionals, useServices } from '@/hooks';
import { AppointmentSummary } from './AppointmentSummary';
import type { Service } from '@/types';

interface AppointmentFormData {
  clientId: string;
  professionalId: string;
  date: string;
  time: string;
  notes: string;
}

interface AppointmentFormProps {
  onSubmit: (data: {
    clientId: string;
    professionalId: string;
    serviceIds: string[];
    scheduledAt: string;
    notes?: string;
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function AppointmentForm({ onSubmit, isLoading, error }: AppointmentFormProps) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: professionals = [], isLoading: isLoadingProfessionals } = useProfessionals();
  const { data: services = [], isLoading: isLoadingServices } = useServices();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
    },
  });

  const selectedServices = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleFormSubmit = async (data: AppointmentFormData) => {
    const scheduledAt = new Date(`${data.date}T${data.time}:00`).toISOString();

    await onSubmit({
      clientId: data.clientId,
      professionalId: data.professionalId,
      serviceIds: selectedServiceIds,
      scheduledAt,
      notes: data.notes || undefined,
    });
  };

  const isDataLoading = isLoadingClients || isLoadingProfessionals || isLoadingServices;

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Erro da API */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
          <div>
            <p className="font-medium text-red-500">Erro ao criar agendamento</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Cliente */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Cliente *
        </label>
        <select
          {...register('clientId', { required: 'Selecione um cliente' })}
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.clientId ? 'border-red-500' : 'border-[var(--border-color)]'
          }`}
        >
          <option value="">Selecione um cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} - {client.phone}
            </option>
          ))}
        </select>
        {errors.clientId && (
          <p className="mt-1 text-sm text-red-500">{errors.clientId.message}</p>
        )}
      </div>

      {/* Profissional */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Profissional *
        </label>
        <select
          {...register('professionalId', { required: 'Selecione um profissional' })}
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.professionalId ? 'border-red-500' : 'border-[var(--border-color)]'
          }`}
        >
          <option value="">Selecione um profissional</option>
          {professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </select>
        {errors.professionalId && (
          <p className="mt-1 text-sm text-red-500">{errors.professionalId.message}</p>
        )}
      </div>

      {/* Serviços (multi-select) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Serviços *
        </label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3">
          {services.map((service) => (
            <ServiceCheckbox
              key={service.id}
              service={service}
              isSelected={selectedServiceIds.includes(service.id)}
              onToggle={() => handleServiceToggle(service.id)}
            />
          ))}
        </div>
        {selectedServiceIds.length === 0 && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Selecione pelo menos um serviço
          </p>
        )}
      </div>

      {/* Resumo */}
      <AppointmentSummary selectedServices={selectedServices} />

      {/* Data e Hora */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Data *
          </label>
          <input
            type="date"
            {...register('date', { required: 'Selecione uma data' })}
            min={new Date().toISOString().split('T')[0]}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.date ? 'border-red-500' : 'border-[var(--border-color)]'
            }`}
          />
          {errors.date && (
            <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Hora *
          </label>
          <input
            type="time"
            {...register('time', { required: 'Selecione um horário' })}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.time ? 'border-red-500' : 'border-[var(--border-color)]'
            }`}
          />
          {errors.time && (
            <p className="mt-1 text-sm text-red-500">{errors.time.message}</p>
          )}
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Observações
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Informações adicionais (opcional)"
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Botão de submit */}
      <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <button
          type="submit"
          disabled={isLoading || selectedServiceIds.length === 0}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Criando...' : 'Criar Agendamento'}
        </button>
      </div>
    </form>
  );
}

// Componente auxiliar para checkbox de serviço
interface ServiceCheckboxProps {
  service: Service;
  isSelected: boolean;
  onToggle: () => void;
}

function ServiceCheckbox({ service, isSelected, onToggle }: ServiceCheckboxProps) {
  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-[var(--card-bg)]">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-4 w-4 rounded border-[var(--border-color)] text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{service.name}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {service.durationMinutes}min • {formatCurrency(service.price)}
        </p>
      </div>
    </label>
  );
}
