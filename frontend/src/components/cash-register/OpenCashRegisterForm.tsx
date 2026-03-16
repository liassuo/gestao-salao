import { useState } from 'react';
import { AlertCircle, Loader2, DollarSign, StickyNote, ArrowRight } from 'lucide-react';
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
  const [showNotes, setShowNotes] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const openingBalanceCents = openingBalanceReais
      ? Math.round(parseFloat(openingBalanceReais.replace(',', '.')) * 100)
      : 0;
    await onSubmit({
      openingBalance: openingBalanceCents,
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header visual */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#C8923A]/20">
          <DollarSign className="h-10 w-10 text-[#C8923A]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Abrir Caixa</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {dateStr}
        </p>
        <p className="text-xs text-[var(--text-muted)]">{timeStr}</p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Saldo Inicial - Input grande e destacado */}
          <div>
            <label
              htmlFor="openingBalance"
              className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
            >
              Saldo inicial em dinheiro
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--text-muted)]">
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
                className="w-full rounded-xl border-2 border-[var(--border-color)] bg-[var(--hover-bg)] py-4 pl-14 pr-4 text-2xl font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:border-[#C8923A] focus:outline-none transition-colors"
                autoFocus
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Conte o dinheiro fisico no caixa antes de abrir
            </p>
          </div>

          {/* Toggle observações */}
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <StickyNote className="h-4 w-4" />
              Adicionar observacao
            </button>
          ) : (
            <div>
              <label
                htmlFor="notes"
                className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Observacoes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Troco recebido do banco, notas de R$2..."
                rows={2}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
              />
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B6914] px-4 py-3.5 text-base font-semibold text-white transition-all hover:bg-[#725510] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Abrir Caixa
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
