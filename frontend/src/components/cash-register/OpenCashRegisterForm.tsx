import { useState } from 'react';
import {
  AlertCircle,
  Loader2,
  DollarSign,
  StickyNote,
  ArrowRight,
  Clock,
  CalendarDays,
  Banknote,
} from 'lucide-react';
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
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);
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

  const displayValue = (openingBalanceCents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleMoneyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setOpeningBalanceCents(parseInt(digits) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      openingBalance: openingBalanceCents,
      notes: notes || undefined,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Coluna esquerda - Info + dicas */}
      <div className="space-y-4 lg:col-span-1">
        {/* Banner de status */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C8923A] to-[#8B6914] p-6 text-white">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-white/10" />
          <div className="absolute right-6 bottom-0 h-16 w-16 translate-y-6 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <DollarSign className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Abrir Caixa</h2>
            <p className="mt-1 text-sm text-white/70">
              Inicie o controle financeiro do dia
            </p>
          </div>
        </div>

        {/* Info cards */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C8923A]/10">
              <CalendarDays className="h-4 w-4 text-[#C8923A]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Data</p>
              <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{dateStr}</p>
            </div>
          </div>
          <div className="border-t border-[var(--border-color)]" />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C8923A]/10">
              <Clock className="h-4 w-4 text-[#C8923A]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Horario</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{timeStr}</p>
            </div>
          </div>
        </div>

        {/* Dica */}
        <div className="rounded-xl border border-[#C8923A]/20 bg-[#C8923A]/5 p-4">
          <div className="flex gap-3">
            <Banknote className="h-5 w-5 text-[#C8923A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Dica</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">
                Conte todas as notas e moedas no caixa antes de abrir. Isso garante o controle correto de sobras e faltas no fechamento.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Coluna direita - Formulario */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-5">
            Saldo inicial
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Dinheiro em caixa agora
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--text-muted)]">
                  R$
                </span>
                <input
                  type="text"
                  id="openingBalance"
                  inputMode="numeric"
                  value={displayValue}
                  onChange={handleMoneyInput}
                  placeholder="0,00"
                  className="w-full rounded-xl border-2 border-[var(--border-color)] bg-[var(--hover-bg)] py-4 pl-14 pr-4 text-2xl font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:border-[#C8923A] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Conte o dinheiro fisico no caixa antes de abrir
              </p>
            </div>

            {/* Toggle observacoes */}
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
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
                />
              </div>
            )}

            {/* Botao */}
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
    </div>
  );
}
