import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useClients, useAppointments } from '@/hooks';
import { useAuth } from '@/auth';
import { formatPhone } from '@/utils/format';
import type { PaymentMethod, CreatePaymentPayload } from '@/types';
import { paymentMethodLabels } from '@/types';

interface PaymentFormData {
  clientId: string;
  appointmentId: string;
  amount: string; // input como string, converter para centavos
  method: PaymentMethod;
  notes: string;
}

interface PaymentFormProps {
  onSubmit: (payload: CreatePaymentPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const paymentMethods: PaymentMethod[] = ['CASH', 'PIX', 'CARD'];

// Converte valor em reais (string) para centavos
function reaisToCentavos(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

// Formata valor para exibição
function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const cents = parseInt(numbers, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PaymentForm({ onSubmit, isLoading, error }: PaymentFormProps) {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: appointments = [], isLoading: isLoadingAppointments } = useAppointments(
    selectedClientId ? { clientId: selectedClientId, status: 'ATTENDED' } : undefined
  );

  // Filtrar apenas agendamentos não pagos do cliente
  const unpaidAppointments = appointments.filter((a) => !a.isPaid);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>({
    defaultValues: {
      method: 'PIX',
    },
  });

  const watchedClientId = watch('clientId');
  // Atualiza selectedClientId quando o cliente muda
  useEffect(() => {
    if (watchedClientId !== selectedClientId) {
      setSelectedClientId(watchedClientId);
      setValue('appointmentId', '');
    }
  }, [watchedClientId, selectedClientId, setValue]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setValue('amount', formatted);
  };

  const handleFormSubmit = async (data: PaymentFormData) => {
    if (!user) return;

    const amountInCents = reaisToCentavos(data.amount);

    await onSubmit({
      clientId: data.clientId,
      appointmentId: data.appointmentId || undefined,
      amount: amountInCents,
      method: data.method,
      registeredBy: user.id,
      notes: data.notes || undefined,
    });
  };

  const isDataLoading = isLoadingClients;

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
            <p className="font-medium text-[#A63030]">Erro ao registrar pagamento</p>
            <p className="text-sm text-[#C45050]">{error}</p>
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
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
            errors.clientId ? 'border-[#A63030]' : 'border-[var(--border-color)]'
          }`}
        >
          <option value="">Selecione um cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} - {formatPhone(client.phone)}
            </option>
          ))}
        </select>
        {errors.clientId && (
          <p className="mt-1 text-sm text-[#A63030]">{errors.clientId.message}</p>
        )}
      </div>

      {/* Agendamento (opcional) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Agendamento <span className="text-[var(--text-muted)]">(opcional)</span>
        </label>
        <select
          {...register('appointmentId')}
          disabled={!selectedClientId || isLoadingAppointments}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] disabled:opacity-50"
        >
          <option value="">
            {!selectedClientId
              ? 'Selecione um cliente primeiro'
              : unpaidAppointments.length === 0
              ? 'Nenhum agendamento pendente'
              : 'Selecione um agendamento'}
          </option>
          {unpaidAppointments.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {new Date(appointment.scheduledAt).toLocaleDateString('pt-BR')} -{' '}
              {(appointment.services || []).map((s: any) => s.service?.name || s.name || 'Serviço').join(', ')} - R${' '}
              {(appointment.totalPrice / 100).toFixed(2)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Vincular a um agendamento atendido não pago
        </p>
      </div>

      {/* Valor */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Valor *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            R$
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            {...register('amount', {
              required: 'Informe o valor',
              validate: (value) =>
                reaisToCentavos(value) > 0 || 'Valor deve ser maior que zero',
            })}
            onChange={handleAmountChange}
            className={`w-full rounded-xl border bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
              errors.amount ? 'border-[#A63030]' : 'border-[var(--border-color)]'
            }`}
          />
        </div>
        {errors.amount && (
          <p className="mt-1 text-sm text-[#A63030]">{errors.amount.message}</p>
        )}
      </div>

      {/* Método de Pagamento */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Método de Pagamento *
        </label>
        <div className="grid grid-cols-3 gap-3">
          {paymentMethods.map((method) => {
            const isSelected = watch('method') === method;
            return (
              <label
                key={method}
                className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-[#C8923A] bg-[#C8923A]/20 text-[#C8923A]'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
              >
                <input
                  type="radio"
                  value={method}
                  {...register('method', { required: true })}
                  className="sr-only"
                />
                {paymentMethodLabels[method]}
              </label>
            );
          })}
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Observações
        </label>
        <textarea
          {...register('notes')}
          rows={2}
          placeholder="Informações adicionais (opcional)"
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
      </div>

      {/* Botão de submit */}
      <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Registrando...' : 'Registrar Pagamento'}
        </button>
      </div>
    </form>
  );
}
