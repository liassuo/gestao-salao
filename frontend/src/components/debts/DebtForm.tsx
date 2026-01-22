import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useClients } from '@/hooks';
import type { CreateDebtPayload } from '@/types';

interface DebtFormProps {
  onSubmit: (payload: CreateDebtPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function DebtForm({ onSubmit, isLoading, error }: DebtFormProps) {
  const [clientId, setClientId] = useState('');
  const [amountReais, setAmountReais] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: clients, isLoading: isLoadingClients } = useClients();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId || !amountReais) return;

    // Converte reais para centavos
    const amountCents = Math.round(parseFloat(amountReais.replace(',', '.')) * 100);

    await onSubmit({
      clientId,
      amount: amountCents,
      description: description || undefined,
      dueDate: dueDate || undefined,
    });
  };

  const isValid = clientId && amountReais && parseFloat(amountReais.replace(',', '.')) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Cliente */}
      <div>
        <label
          htmlFor="clientId"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Cliente *
        </label>
        <select
          id="clientId"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={isLoadingClients}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:bg-gray-100"
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
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Valor Total (R$) *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            R$
          </span>
          <input
            type="text"
            id="amount"
            value={amountReais}
            onChange={(e) => {
              // Permite apenas números e vírgula/ponto
              const value = e.target.value.replace(/[^\d,\.]/g, '');
              setAmountReais(value);
            }}
            placeholder="0,00"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            required
          />
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Descrição
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Motivo ou detalhes da dívida..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </div>

      {/* Data de Vencimento */}
      <div>
        <label
          htmlFor="dueDate"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Data de Vencimento
        </label>
        <input
          type="date"
          id="dueDate"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </div>

      {/* Botão Submit */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : 'Criar Dívida'}
        </button>
      </div>
    </form>
  );
}
