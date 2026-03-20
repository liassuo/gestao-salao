import { useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { Debt, PartialPaymentPayload } from '@/types';
import { paymentMethodLabels } from '@/types';

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: PartialPaymentPayload) => Promise<void>;
  debt: Debt | null;
  isLoading: boolean;
  error: string | null;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
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

const methodOptions = ['CASH', 'PIX', 'CARD'] as const;

export function DebtPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  debt,
  isLoading,
  error,
}: DebtPaymentModalProps) {
  const [amountReais, setAmountReais] = useState('');
  const [method, setMethod] = useState<string>('CASH');
  const [notes, setNotes] = useState('');

  if (!isOpen || !debt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amountReais) return;

    const amountCents = parseCurrencyInput(amountReais);

    await onSubmit({
      amount: amountCents,
      method: method as PartialPaymentPayload['method'],
      notes: notes || undefined,
    });

    setAmountReais('');
    setMethod('CASH');
    setNotes('');
  };

  const amountCents = parseCurrencyInput(amountReais);
  const isValidAmount = amountCents > 0 && amountCents <= debt.remainingBalance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Registrar Pagamento
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Info da Dívida */}
          <div className="mb-6 rounded-xl bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Cliente:</span> {debt.client?.name || 'Cliente'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Valor total:</span>{' '}
              {formatCurrency(debt.amount)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Já pago:</span>{' '}
              <span className="text-[#C8923A]">
                {formatCurrency(debt.amountPaid)}
              </span>
            </p>
            <p className="mt-2 border-t border-[var(--border-color)] pt-2 text-sm font-medium text-[var(--text-primary)]">
              Saldo restante:{' '}
              <span className="text-[#A63030]">
                {formatCurrency(debt.remainingBalance)}
              </span>
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Valor */}
          <div className="mb-4">
            <label
              htmlFor="paymentAmount"
              className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
            >
              Valor a Pagar *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                R$
              </span>
              <input
                type="text"
                id="paymentAmount"
                value={amountReais}
                onChange={(e) => {
                  setAmountReais(formatCurrencyInput(e.target.value));
                }}
                placeholder="0,00"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
                autoFocus
                required
              />
            </div>
            {amountCents > debt.remainingBalance && (
              <p className="mt-1 text-xs text-[#A63030]">
                O valor não pode exceder o saldo restante
              </p>
            )}
          </div>

          {/* Método de Pagamento */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Forma de Pagamento *
            </label>
            <div className="flex gap-2">
              {methodOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    method === m
                      ? 'border-[#C8923A] bg-[#C8923A]/20 text-[#C8923A]'
                      : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
                  }`}
                >
                  {paymentMethodLabels[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="mb-6">
            <label
              htmlFor="paymentNotes"
              className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
            >
              Observações
            </label>
            <textarea
              id="paymentNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o pagamento..."
              rows={2}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !isValidAmount}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Salvando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
