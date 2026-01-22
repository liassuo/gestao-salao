import { useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { Debt, PartialPaymentPayload } from '@/types';

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

export function DebtPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  debt,
  isLoading,
  error,
}: DebtPaymentModalProps) {
  const [amountReais, setAmountReais] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !debt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amountReais) return;

    // Converte reais para centavos
    const amountCents = Math.round(parseFloat(amountReais.replace(',', '.')) * 100);

    await onSubmit({
      amount: amountCents,
      notes: notes || undefined,
    });

    // Limpa o formulário após sucesso
    setAmountReais('');
    setNotes('');
  };

  const amountCents = amountReais
    ? Math.round(parseFloat(amountReais.replace(',', '.')) * 100)
    : 0;

  const isValidAmount = amountCents > 0 && amountCents <= debt.remainingBalance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Registrar Pagamento
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Info da Dívida */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Cliente:</span> {debt.client.name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Valor total:</span>{' '}
              {formatCurrency(debt.amount)}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Já pago:</span>{' '}
              <span className="text-green-600">
                {formatCurrency(debt.amountPaid)}
              </span>
            </p>
            <p className="mt-2 border-t border-gray-200 pt-2 text-sm font-medium text-gray-900">
              Saldo restante:{' '}
              <span className="text-red-600">
                {formatCurrency(debt.remainingBalance)}
              </span>
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Valor */}
          <div className="mb-4">
            <label
              htmlFor="paymentAmount"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Valor a Pagar *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                R$
              </span>
              <input
                type="text"
                id="paymentAmount"
                value={amountReais}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,\.]/g, '');
                  setAmountReais(value);
                }}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>
            {amountCents > debt.remainingBalance && (
              <p className="mt-1 text-xs text-red-600">
                O valor não pode exceder o saldo restante
              </p>
            )}
          </div>

          {/* Observações */}
          <div className="mb-6">
            <label
              htmlFor="paymentNotes"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Observações
            </label>
            <textarea
              id="paymentNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o pagamento..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !isValidAmount}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
