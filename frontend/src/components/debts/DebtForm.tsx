import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Calendar, Receipt } from 'lucide-react';
import { useClients } from '@/hooks';
import { appointmentsService } from '@/services/appointments';
import { ordersService } from '@/services/orders';
import type { CreateDebtPayload } from '@/types';

interface DebtFormProps {
  onSubmit: (payload: CreateDebtPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  /** Pre-fill from an appointment (used by "Gerar Dívida" in appointments) */
  prefill?: {
    clientId: string;
    appointmentId: string;
    amount: number;
    description: string;
  };
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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

type UnpaidItem = {
  type: 'appointment' | 'order';
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  description: string;
  date: string;
};

export function DebtForm({ onSubmit, isLoading, error, prefill }: DebtFormProps) {
  const [clientId, setClientId] = useState(prefill?.clientId || '');
  const [amountReais, setAmountReais] = useState(
    prefill ? formatCurrencyInput(String(prefill.amount)) : '',
  );
  const [description, setDescription] = useState(prefill?.description || '');
  const [dueDate, setDueDate] = useState('');
  const [appointmentId, setAppointmentId] = useState(prefill?.appointmentId || '');

  // Unpaid items
  const [unpaidItems, setUnpaidItems] = useState<UnpaidItem[]>([]);
  const [isLoadingUnpaid, setIsLoadingUnpaid] = useState(false);

  const { data: clients, isLoading: isLoadingClients } = useClients();

  // Load unpaid appointments and orders
  useEffect(() => {
    if (prefill) return; // Skip if prefilled
    async function loadUnpaid() {
      setIsLoadingUnpaid(true);
      try {
        const [appointments, orders] = await Promise.all([
          appointmentsService.listUnpaid(),
          ordersService.list({ status: 'PENDING' }),
        ]);

        const items: UnpaidItem[] = [];

        for (const appt of appointments) {
          const serviceNames = (appt.services || [])
            .map((s) => s.service?.name || 'Serviço')
            .join(', ');
          items.push({
            type: 'appointment',
            id: appt.id,
            clientId: appt.client?.id || '',
            clientName: appt.client?.name || (appt as any).clientName || 'Cliente',
            amount: appt.totalPrice,
            description: `Agendamento: ${serviceNames}`,
            date: appt.scheduledAt,
          });
        }

        for (const order of orders) {
          if (!order.client?.id) continue;
          const itemNames = (order.items || [])
            .map((i) => i.product?.name || i.service?.name || 'Item')
            .join(', ');
          items.push({
            type: 'order',
            id: order.id,
            clientId: order.client.id,
            clientName: order.client.name,
            amount: order.totalAmount,
            description: `Comanda: ${itemNames}`,
            date: order.createdAt,
          });
        }

        setUnpaidItems(items);
      } catch {
        // Silently fail - form still works manually
      } finally {
        setIsLoadingUnpaid(false);
      }
    }
    loadUnpaid();
  }, [prefill]);

  const handleSelectUnpaidItem = (item: UnpaidItem) => {
    setClientId(item.clientId);
    setAmountReais(formatCurrencyInput(String(item.amount)));
    setDescription(item.description);
    if (item.type === 'appointment') {
      setAppointmentId(item.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId || !amountReais) return;

    const amountCents = parseCurrencyInput(amountReais);

    await onSubmit({
      clientId,
      amount: amountCents,
      appointmentId: appointmentId || undefined,
      description: description || undefined,
      dueDate: dueDate || undefined,
    });
  };

  const isValid = clientId && amountReais && parseCurrencyInput(amountReais) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Itens não pagos */}
      {!prefill && unpaidItems.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Itens não pagos (clique para selecionar)
          </label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3">
            {unpaidItems.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => handleSelectUnpaidItem(item)}
                className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-left transition-colors hover:border-[#A63030]/50 hover:bg-[#A63030]/5"
              >
                {item.type === 'appointment' ? (
                  <Calendar className="h-4 w-4 flex-shrink-0 text-[#C8923A]" />
                ) : (
                  <Receipt className="h-4 w-4 flex-shrink-0 text-[#C8923A]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {item.clientName}
                    </span>
                    <span className="flex-shrink-0 text-sm font-medium text-[#A63030]">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[var(--text-muted)]">
                      {item.description}
                    </span>
                    <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                      {formatDate(item.date)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!prefill && isLoadingUnpaid && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando itens não pagos...
        </div>
      )}

      {/* Cliente */}
      <div>
        <label
          htmlFor="clientId"
          className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
        >
          Cliente *
        </label>
        <select
          id="clientId"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={isLoadingClients || !!prefill}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:border-[#A63030] focus:outline-none focus:ring-1 focus:ring-[#8B2020] disabled:opacity-50"
          required
        >
          <option value="">Selecione um cliente</option>
          {clients?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Valor */}
      <div>
        <label
          htmlFor="amount"
          className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
        >
          Valor Total (R$) *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            R$
          </span>
          <input
            type="text"
            id="amount"
            value={amountReais}
            onChange={(e) => {
              setAmountReais(formatCurrencyInput(e.target.value));
            }}
            placeholder="0,00"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#A63030] focus:outline-none focus:ring-1 focus:ring-[#8B2020]"
            required
          />
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
        >
          Descrição
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Motivo ou detalhes da dívida..."
          rows={3}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#A63030] focus:outline-none focus:ring-1 focus:ring-[#8B2020]"
        />
      </div>

      {/* Data de Vencimento */}
      <div>
        <label
          htmlFor="dueDate"
          className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
        >
          Data de Vencimento
        </label>
        <input
          type="date"
          id="dueDate"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:border-[#A63030] focus:outline-none focus:ring-1 focus:ring-[#8B2020]"
        />
      </div>

      {/* Botão Submit */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="flex items-center gap-2 rounded-xl bg-[#8B2020] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#6B1818] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : 'Criar Dívida'}
        </button>
      </div>
    </form>
  );
}
