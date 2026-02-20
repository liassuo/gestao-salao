import { useState } from 'react';
import { AlertCircle, Loader2, Wallet } from 'lucide-react';
import type { OpenCashRegisterPayload } from '@/types';

interface OpenCashRegisterFormProps {
  onSubmit: (payload: OpenCashRegisterPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function OpenCashRegisterForm({
  onSubmit,
  isLoading,
  error,
}: OpenCashRegisterFormProps) {
  const [openingBalanceReais, setOpeningBalanceReais] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Converte reais para centavos
    const openingBalanceCents = openingBalanceReais
      ? Math.round(parseFloat(openingBalanceReais.replace(',', '.')) * 100)
      : 0;

    await onSubmit({
      openingBalance: openingBalanceCents,
      notes: notes || undefined,
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C8923A]/20">
          <Wallet className="h-6 w-6 text-[#C8923A]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Abrir Caixa</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Informe o saldo inicial para começar o dia
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Saldo Inicial */}
        <div>
          <label
            htmlFor="openingBalance"
            className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
          >
            Saldo Inicial (R$) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              R$
            </span>
            <input
              type="text"
              id="openingBalance"
              value={openingBalanceReais}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d,\.]/g, '');
                setOpeningBalanceReais(value);
              }}
              placeholder="0,00"
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
              autoFocus
            />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Valor em dinheiro no caixa no início do dia
          </p>
        </div>

        {/* Observações */}
        <div>
          <label
            htmlFor="notes"
            className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
          >
            Observações
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a abertura do caixa..."
            rows={3}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
          />
        </div>

        {/* Botão Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B6914] px-4 py-3 font-medium text-white transition-colors hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Abrindo Caixa...' : 'Abrir Caixa'}
        </button>
      </form>
    </div>
  );
}
