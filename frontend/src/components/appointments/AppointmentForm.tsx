import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2, Search, X } from 'lucide-react';
import { useClients, useProfessionals, useServices, useActivePromotions, useClientSubscription } from '@/hooks';
import { formatPhone } from '@/utils/format';
import { AppointmentSummary } from './AppointmentSummary';
import { useToast } from '@/components/ui/ToastContext';
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
    clientId?: string;
    clientName?: string;
    professionalId: string;
    serviceIds: string[];
    scheduledAt: string;
    notes?: string;
    billingType?: 'PIX' | 'CREDIT_CARD';
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  prefill?: {
    professionalId?: string;
    date?: string;
    time?: string;
  };
}

function getDefaultDateTime(): { date: string; time: string } {
  const now = new Date();
  const minutes = now.getMinutes();
  // Arredondar para os próximos 30 minutos
  const roundedMinutes = minutes < 30 ? 30 : 0;
  const hours = roundedMinutes === 0 ? now.getHours() + 1 : now.getHours();

  if (hours >= 21 || hours < 9) {
    // Fora do horário de funcionamento: avançar para 09:00 do próximo dia
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: tomorrow.toISOString().split('T')[0], time: '09:00' };
  }

  return {
    date: now.toISOString().split('T')[0],
    time: `${String(hours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`,
  };
}

export function AppointmentForm({ onSubmit, isLoading, error, prefill }: AppointmentFormProps) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const toast = useToast();

  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: professionals = [], isLoading: isLoadingProfessionals } = useProfessionals();
  const { data: services = [], isLoading: isLoadingServices } = useServices();
  const { data: activePromotions = [] } = useActivePromotions();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    defaultValues: (() => {
      const defaults = getDefaultDateTime();
      return {
        date: prefill?.date || defaults.date,
        time: prefill?.time || defaults.time,
        professionalId: prefill?.professionalId || '',
      };
    })(),
  });

  const watchedProfessionalId = watch('professionalId');
  const watchedClientId = watch('clientId');
  const watchedDate = watch('date');
  const watchedTime = watch('time');

  const { data: clientSub } = useClientSubscription(watchedClientId || undefined);
  const planDiscount = clientSub && clientSub.status === 'ACTIVE' ? clientSub.plan?.discountPercent ?? 0 : 0;
  const planLabel = clientSub?.plan?.name ? `Plano ${clientSub.plan.name}` : undefined;

  // Client autocomplete
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; phone: string } | null>(null);

  const hasClient = !!watchedClientId || !!clientSearch.trim();
  const isFormComplete =
    hasClient &&
    !!watchedProfessionalId &&
    selectedServiceIds.length > 0 &&
    !!watchedDate &&
    !!watchedTime;

  const handleDisabledClick = () => {
    if (isFormComplete || isLoading) return;
    const missing: string[] = [];
    if (!watchedClientId && !clientSearch.trim()) missing.push('Cliente');
    if (!watchedProfessionalId) missing.push('Profissional');
    if (selectedServiceIds.length === 0) missing.push('Serviço');
    if (!watchedDate) missing.push('Data');
    if (!watchedTime) missing.push('Hora');
    toast.warning('Preencha os campos obrigatórios', `Faltam: ${missing.join(', ')}`);
  };
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    ).slice(0, 10);
  }, [clients, clientSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(e.target as Node) &&
        clientInputRef.current &&
        !clientInputRef.current.contains(e.target as Node)
      ) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectClient = (client: typeof clients[0]) => {
    setSelectedClient({ id: client.id, name: client.name, phone: client.phone });
    setClientSearch('');
    setClientDropdownOpen(false);
    setValue('clientId', client.id, { shouldValidate: true });
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientSearch('');
    setValue('clientId', '', { shouldValidate: true });
    clientInputRef.current?.focus();
  };

  const availableServices = useMemo(() => {
    if (!watchedProfessionalId) return services;
    const professional = professionals.find((p) => p.id === watchedProfessionalId);
    if (!professional?.services?.length) return services;
    const profServiceIds = new Set(professional.services.map((s) => s.id));
    return services.filter((s) => profServiceIds.has(s.id));
  }, [services, professionals, watchedProfessionalId]);

  // Limpar serviços selecionados que não estão mais disponíveis ao trocar profissional
  useMemo(() => {
    const availableIds = new Set(availableServices.map((s) => s.id));
    const filtered = selectedServiceIds.filter((id) => availableIds.has(id));
    if (filtered.length !== selectedServiceIds.length) {
      setSelectedServiceIds(filtered);
    }
  }, [availableServices]);

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
    // Validar que tem cliente (cadastrado ou nome avulso)
    if (!data.clientId && !clientSearch.trim()) {
      toast.error('Cliente obrigatório', 'Selecione um cliente ou digite o nome');
      return;
    }

    // Enviar como string local sem converter para UTC, evitando deslocamento de fuso
    const scheduledAt = `${data.date}T${data.time}:00`;

    await onSubmit({
      ...(data.clientId ? { clientId: data.clientId } : { clientName: clientSearch.trim() }),
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
        <Loader2 className="h-8 w-8 animate-spin text-[#C8923A]" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Erro da API */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[#A63030]" />
          <div>
            <p className="font-medium text-[#A63030]">Erro ao criar agendamento</p>
            <p className="text-sm text-[#C45050]">{error}</p>
          </div>
        </div>
      )}

      {/* Cliente */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Cliente
        </label>
        <input type="hidden" {...register('clientId')} />
        {selectedClient ? (
          <div className={`flex items-center justify-between rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 ${errors.clientId ? 'border-[#A63030]' : 'border-[var(--border-color)]'}`}>
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{selectedClient.name}</span>
              <span className="ml-2 text-xs text-[var(--text-muted)]">{formatPhone(selectedClient.phone)}</span>
            </div>
            <button type="button" onClick={handleClearClient} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={clientInputRef}
              type="text"
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setClientDropdownOpen(true); }}
              onFocus={() => setClientDropdownOpen(true)}
              placeholder="Buscar cliente por nome ou telefone..."
              className={`w-full rounded-xl border bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
                errors.clientId ? 'border-[#A63030]' : 'border-[var(--border-color)]'
              }`}
            />
            {clientDropdownOpen && filteredClients.length > 0 && (
              <div ref={clientDropdownRef} className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] py-1 shadow-lg">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--hover-bg)]"
                  >
                    <span className="font-medium text-[var(--text-primary)]">{client.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{formatPhone(client.phone)}</span>
                  </button>
                ))}
              </div>
            )}
            {clientDropdownOpen && clientSearch && filteredClients.length === 0 && (
              <div ref={clientDropdownRef} className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-3 shadow-lg">
                <p className="text-sm text-[var(--text-muted)]">Nenhum cliente encontrado — o nome digitado será usado como cliente avulso</p>
              </div>
            )}
          </div>
        )}
        {errors.clientId && !clientSearch.trim() && (
          <p className="mt-1 text-sm text-[#A63030]">Selecione um cliente ou digite o nome</p>
        )}
      </div>

      {/* Profissional */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Profissional *
        </label>
        <select
          {...register('professionalId', { required: 'Selecione um profissional' })}
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
            errors.professionalId ? 'border-[#A63030]' : 'border-[var(--border-color)]'
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
          <p className="mt-1 text-sm text-[#A63030]">{errors.professionalId.message}</p>
        )}
      </div>

      {/* Serviços (multi-select) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Serviços *
        </label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3">
          {availableServices.length === 0 ? (
            <p className="py-2 text-center text-sm text-[var(--text-muted)]">
              {watchedProfessionalId ? 'Nenhum serviço vinculado a este profissional' : 'Selecione um profissional primeiro'}
            </p>
          ) : (
            availableServices.map((service) => (
              <ServiceCheckbox
                key={service.id}
                service={service}
                isSelected={selectedServiceIds.includes(service.id)}
                onToggle={() => handleServiceToggle(service.id)}
              />
            ))
          )}
        </div>
        {selectedServiceIds.length === 0 && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Selecione pelo menos um serviço
          </p>
        )}
      </div>

      {/* Resumo */}
      <AppointmentSummary
        selectedServices={selectedServices}
        promotions={activePromotions}
        planDiscountPercent={planDiscount}
        planLabel={planLabel}
      />

      {/* Data e Hora */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Data *
          </label>
          <input
            type="date"
            {...register('date', { required: 'Selecione uma data' })}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
              errors.date ? 'border-[#A63030]' : 'border-[var(--border-color)]'
            }`}
          />
          {errors.date && (
            <p className="mt-1 text-sm text-[#A63030]">{errors.date.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Hora *
          </label>
          <input
            type="time"
            {...register('time', { required: 'Selecione um horário' })}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
              errors.time ? 'border-[#A63030]' : 'border-[var(--border-color)]'
            }`}
          />
          {errors.time && (
            <p className="mt-1 text-sm text-[#A63030]">{errors.time.message}</p>
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
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
      </div>

      {/* Botão de submit */}
      <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <div onClick={!isFormComplete ? handleDisabledClick : undefined}>
          <button
            type="submit"
            disabled={isLoading || !isFormComplete}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Criando...' : 'Criar Agendamento'}
          </button>
        </div>
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
        className="h-4 w-4 rounded border-[var(--border-color)] text-[#C8923A] focus:ring-[#C8923A]"
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
