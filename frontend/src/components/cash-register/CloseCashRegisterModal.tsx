import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Loader2,
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Banknote,
  Smartphone,
  CreditCard,
  Lock,
} from 'lucide-react';
import type { CashRegister, CloseCashRegisterPayload } from '@/types';

interface CloseCashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CloseCashRegisterPayload) => Promise<void>;
  cashRegister: CashRegister | null;
  isLoading: boolean;
  error: string | null;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CloseCashRegisterModal({
  isOpen,
  onClose,
  onSubmit,
  cashRegister,
  isLoading,
  error,
}: CloseCashRegisterModalProps) {
  const [closingBalanceCents, setClosingBalanceCents] = useState(0);
  const [closingBalanceDisplay, setClosingBalanceDisplay] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setClosingBalanceCents(0);
      setClosingBalanceDisplay('');
      setNotes('');
    }
  }, [isOpen]);

  const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo que não é dígito
    const digits = e.target.value.replace(/\D/g, '');
    const cents = parseInt(digits || '0', 10);
    setClosingBalanceCents(cents);

    if (cents === 0) {
      setClosingBalanceDisplay('');
    } else {
      setClosingBalanceDisplay(
        new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
      );
    }
  };

  if (!isOpen || !cashRegister) return null;

  const expectedBalance = cashRegister.openingBalance + cashRegister.totalCash;
  const discrepancy = closingBalanceCents - expectedBalance;
  const hasInput = closingBalanceCents > 0 || closingBalanceDisplay !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      closingBalance: closingBalanceCents,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Fechar Caixa</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Aberto as {formatTime(cashRegister.openedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Resumo do dia + Caixa físico lado a lado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Resumo do dia */}
            <div className="rounded-xl bg-[var(--hover-bg)] p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Resumo do dia
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center rounded-lg bg-[var(--card-bg)] p-3">
                  <Banknote className="h-4 w-4 mx-auto text-green-500 mb-1" />
                  <p className="text-xs text-[var(--text-muted)]">Dinheiro</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {formatCurrency(cashRegister.totalCash)}
                  </p>
                </div>
                <div className="text-center rounded-lg bg-[var(--card-bg)] p-3">
                  <Smartphone className="h-4 w-4 mx-auto text-purple-500 mb-1" />
                  <p className="text-xs text-[var(--text-muted)]">PIX</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {formatCurrency(cashRegister.totalPix)}
                  </p>
                </div>
                <div className="text-center rounded-lg bg-[var(--card-bg)] p-3">
                  <CreditCard className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                  <p className="text-xs text-[var(--text-muted)]">Cartão</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {formatCurrency(cashRegister.totalCard)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-3">
                <span className="text-sm text-[var(--text-secondary)]">Receita total</span>
                <span className="text-base font-bold text-[var(--text-primary)]">
                  {formatCurrency(cashRegister.totalRevenue)}
                </span>
              </div>
            </div>

            {/* Cálculo do caixa físico */}
            <div className="rounded-xl border border-[var(--border-color)] p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Caixa físico (dinheiro)
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Saldo inicial</span>
                <span className="text-[var(--text-primary)]">
                  {formatCurrency(cashRegister.openingBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">+ Dinheiro recebido</span>
                <span className="text-green-500">
                  +{formatCurrency(cashRegister.totalCash)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-[var(--border-color)] pt-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Esperado</span>
                <span className="text-base font-bold text-[#C8923A]">
                  {formatCurrency(expectedBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Input do valor contado */}
          <div>
            <label
              htmlFor="closingBalance"
              className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
            >
              Quanto tem no caixa agora?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--text-muted)]">
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                id="closingBalance"
                value={closingBalanceDisplay}
                onChange={handleCurrencyInput}
                placeholder="0,00"
                className="w-full rounded-xl border-2 border-[var(--border-color)] bg-[var(--hover-bg)] py-3.5 pl-14 pr-4 text-2xl font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:border-[#C8923A] focus:outline-none transition-colors"
                autoFocus
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Conte todo o dinheiro físico no caixa
            </p>
          </div>

          {/* Discrepância - visual grande */}
          {hasInput && (
            <div
              className={`flex items-center justify-between rounded-xl p-4 transition-all ${
                discrepancy > 0
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : discrepancy < 0
                  ? 'bg-red-500/10 border border-red-500/30'
                  : 'bg-green-500/10 border border-green-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {discrepancy > 0 ? (
                  <TrendingUp className="h-6 w-6 text-amber-500" />
                ) : discrepancy < 0 ? (
                  <TrendingDown className="h-6 w-6 text-[#A63030]" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                )}
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      discrepancy > 0
                        ? 'text-amber-500'
                        : discrepancy < 0
                        ? 'text-[#A63030]'
                        : 'text-green-500'
                    }`}
                  >
                    {discrepancy > 0 ? 'Sobra no caixa' : discrepancy < 0 ? 'Falta no caixa' : 'Caixa conferido!'}
                  </p>
                  {discrepancy !== 0 && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {discrepancy > 0
                        ? 'Ha mais dinheiro do que o esperado'
                        : 'Ha menos dinheiro do que o esperado'}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`text-xl font-bold ${
                  discrepancy > 0
                    ? 'text-amber-500'
                    : discrepancy < 0
                    ? 'text-[#A63030]'
                    : 'text-green-500'
                }`}
              >
                {discrepancy !== 0 && (discrepancy > 0 ? '+' : '')}
                {formatCurrency(discrepancy)}
              </span>
            </div>
          )}

          {/* Observações */}
          <div>
            <label
              htmlFor="closeNotes"
              className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
            >
              Observações do fechamento
            </label>
            <textarea
              id="closeNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Faltou troco, retirada para deposito..."
              rows={2}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border-color)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#8B6914] px-4 py-3 text-sm font-semibold text-white hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Fechar Caixa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
