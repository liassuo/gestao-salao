import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

export function CloseCashRegisterModal({
  isOpen,
  onClose,
  onSubmit,
  cashRegister,
  isLoading,
  error,
}: CloseCashRegisterModalProps) {
  const [closingBalanceReais, setClosingBalanceReais] = useState('');
  const [notes, setNotes] = useState('');

  // Limpa o formulário quando abre/fecha
  useEffect(() => {
    if (isOpen) {
      setClosingBalanceReais('');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen || !cashRegister) return null;

  const expectedBalance = cashRegister.openingBalance + cashRegister.totalCash;

  const closingBalanceCents = closingBalanceReais
    ? Math.round(parseFloat(closingBalanceReais.replace(',', '.')) * 100)
    : 0;

  const discrepancy = closingBalanceCents - expectedBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!closingBalanceReais) return;

    await onSubmit({
      closingBalance: closingBalanceCents,
      notes: notes || undefined,
    });
  };

  const getDiscrepancyIcon = () => {
    if (discrepancy > 0) return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (discrepancy < 0) return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <Minus className="h-5 w-5 text-gray-600" />;
  };

  const getDiscrepancyColor = () => {
    if (discrepancy > 0) return 'text-green-600 bg-green-50';
    if (discrepancy < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getDiscrepancyLabel = () => {
    if (discrepancy > 0) return 'Sobra';
    if (discrepancy < 0) return 'Falta';
    return 'Conferido';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">Fechar Caixa</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Resumo do Caixa */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-3 font-medium text-gray-800">Resumo do Caixa</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Saldo Inicial</span>
                <span className="text-gray-900">
                  {formatCurrency(cashRegister.openingBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">+ Dinheiro Recebido</span>
                <span className="text-green-600">
                  {formatCurrency(cashRegister.totalCash)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-medium text-gray-800">Valor Esperado</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(expectedBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Valor Contado */}
          <div className="mb-4">
            <label
              htmlFor="closingBalance"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Valor Contado no Caixa (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                R$
              </span>
              <input
                type="text"
                id="closingBalance"
                value={closingBalanceReais}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,\.]/g, '');
                  setClosingBalanceReais(value);
                }}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Discrepância */}
          {closingBalanceReais && (
            <div
              className={`mb-4 flex items-center justify-between rounded-lg p-4 ${getDiscrepancyColor()}`}
            >
              <div className="flex items-center gap-2">
                {getDiscrepancyIcon()}
                <span className="font-medium">{getDiscrepancyLabel()}</span>
              </div>
              <span className="text-lg font-bold">
                {formatCurrency(Math.abs(discrepancy))}
              </span>
            </div>
          )}

          {/* Observações */}
          <div className="mb-6">
            <label
              htmlFor="closeNotes"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Observações
            </label>
            <textarea
              id="closeNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o fechamento..."
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
              disabled={isLoading || !closingBalanceReais}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Fechando...' : 'Confirmar Fechamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
