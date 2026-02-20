import { Clock, Banknote, CreditCard, Smartphone } from 'lucide-react';
import type { CashRegister } from '@/types';

interface CashRegisterStatusProps {
  cashRegister: CashRegister;
  onClose: () => void;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

export function CashRegisterStatus({ cashRegister, onClose }: CashRegisterStatusProps) {
  const expectedBalance =
    cashRegister.openingBalance + cashRegister.totalCash;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
              <span className="text-lg font-semibold">Caixa Aberto</span>
            </div>
            <p className="mt-1 text-green-100">{formatDate(cashRegister.date)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/20 px-4 py-2 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            Fechar Caixa
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-green-100">
          <Clock className="h-4 w-4" />
          <span>Aberto às {formatTime(cashRegister.openedAt)}</span>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Saldo Inicial */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--hover-bg)]">
              <Banknote className="h-5 w-5 text-[var(--text-muted)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Saldo Inicial</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(cashRegister.openingBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Total em Dinheiro */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <Banknote className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Dinheiro</p>
              <p className="text-lg font-semibold text-green-500">
                {formatCurrency(cashRegister.totalCash)}
              </p>
            </div>
          </div>
        </div>

        {/* Total PIX */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8923A]/20">
              <Smartphone className="h-5 w-5 text-[#C8923A]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">PIX</p>
              <p className="text-lg font-semibold text-[#C8923A]">
                {formatCurrency(cashRegister.totalPix)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Cartão */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8923A]/20">
              <CreditCard className="h-5 w-5 text-[#C8923A]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Cartão</p>
              <p className="text-lg font-semibold text-[#C8923A]">
                {formatCurrency(cashRegister.totalCard)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Resumo do Dia</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Receita Total</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {formatCurrency(cashRegister.totalRevenue)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Saldo Inicial</span>
            <span className="text-[var(--text-primary)]">
              {formatCurrency(cashRegister.openingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">+ Dinheiro Recebido</span>
            <span className="text-green-500">
              {formatCurrency(cashRegister.totalCash)}
            </span>
          </div>
          <hr className="border-[var(--border-color)]" />
          <div className="flex items-center justify-between">
            <span className="font-medium text-[var(--text-primary)]">Valor Esperado no Caixa</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatCurrency(expectedBalance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
