import { useState, useEffect } from 'react';
import {
  Clock,
  Banknote,
  CreditCard,
  Smartphone,
  TrendingUp,
  Lock,
  Wallet,
} from 'lucide-react';
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

function parseLocalDate(dateStr: string): Date {
  // Remove Z ou offset para interpretar como horário local
  const clean = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  // Strings "YYYY-MM-DD" sem hora são interpretadas como UTC pelo JS,
  // causando o dia anterior em fusos negativos. Adiciona T12:00:00 para forçar local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(clean + 'T12:00:00');
  }
  return new Date(clean);
}

function formatTime(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function getElapsedTime(openedAt: string): string {
  const opened = parseLocalDate(openedAt).getTime();
  const now = Date.now();
  const diff = Math.floor((now - opened) / 1000);
  if (diff < 0) return '0min';
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export function CashRegisterStatus({ cashRegister, onClose }: CashRegisterStatusProps) {
  const [elapsed, setElapsed] = useState(getElapsedTime(cashRegister.openedAt));
  const expectedBalance = cashRegister.openingBalance + cashRegister.totalCash;
  const totalRevenue = cashRegister.totalRevenue;

  // Atualiza o tempo decorrido a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedTime(cashRegister.openedAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [cashRegister.openedAt]);

  // Calcular porcentagem de cada método
  const total = cashRegister.totalCash + cashRegister.totalPix + cashRegister.totalCard;
  const cashPct = total > 0 ? (cashRegister.totalCash / total) * 100 : 0;
  const pixPct = total > 0 ? (cashRegister.totalPix / total) * 100 : 0;
  const cardPct = total > 0 ? (cashRegister.totalCard / total) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-6 text-white">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-white/10" />
        <div className="absolute right-8 bottom-0 h-20 w-20 translate-y-6 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                <span className="text-lg font-bold">Caixa Aberto</span>
              </div>
              <p className="mt-1 text-sm text-green-100">{formatDate(cashRegister.date)}</p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
            >
              <Lock className="h-4 w-4" />
              Fechar Caixa
            </button>
          </div>

          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-xs text-green-200 uppercase tracking-wide">Receita do dia</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-green-100">
              <Clock className="h-3.5 w-3.5" />
              <span>Aberto há {elapsed}</span>
              <span className="text-green-300">({formatTime(cashRegister.openedAt)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de método de pagamento */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PaymentMethodCard
          icon={Banknote}
          label="Dinheiro"
          value={cashRegister.totalCash}
          percentage={cashPct}
          color="green"
        />
        <PaymentMethodCard
          icon={Smartphone}
          label="PIX"
          value={cashRegister.totalPix}
          percentage={pixPct}
          color="purple"
        />
        <PaymentMethodCard
          icon={CreditCard}
          label="Cartão"
          value={cashRegister.totalCard}
          percentage={cardPct}
          color="blue"
        />
      </div>

      {/* Barra de proporção visual */}
      {total > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Distribuição por método
          </p>
          <div className="flex h-3 overflow-hidden rounded-full">
            {cashPct > 0 && (
              <div
                className="bg-green-500 transition-all duration-500"
                style={{ width: `${cashPct}%` }}
                title={`Dinheiro: ${cashPct.toFixed(0)}%`}
              />
            )}
            {pixPct > 0 && (
              <div
                className="bg-purple-500 transition-all duration-500"
                style={{ width: `${pixPct}%` }}
                title={`PIX: ${pixPct.toFixed(0)}%`}
              />
            )}
            {cardPct > 0 && (
              <div
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${cardPct}%` }}
                title={`Cartão: ${cardPct.toFixed(0)}%`}
              />
            )}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-[var(--text-muted)]">
            {cashPct > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                Dinheiro {cashPct.toFixed(0)}%
              </div>
            )}
            {pixPct > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                PIX {pixPct.toFixed(0)}%
              </div>
            )}
            {cardPct > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Cartão {cardPct.toFixed(0)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo financeiro */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Resumo do Caixa Físico
          </h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Saldo inicial</span>
            <span className="font-medium text-[var(--text-primary)]">
              {formatCurrency(cashRegister.openingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">+ Dinheiro recebido</span>
            <span className="font-medium text-green-500">
              +{formatCurrency(cashRegister.totalCash)}
            </span>
          </div>
          <div className="border-t border-dashed border-[var(--border-color)] pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#C8923A]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Esperado no caixa</span>
              </div>
              <span className="text-xl font-bold text-[#C8923A]">
                {formatCurrency(expectedBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodCard({
  icon: Icon,
  label,
  value,
  percentage,
  color,
}: {
  icon: typeof Banknote;
  label: string;
  value: number;
  percentage: number;
  color: 'green' | 'purple' | 'blue';
}) {
  const colorMap = {
    green: {
      bg: 'bg-green-500/10',
      icon: 'text-green-500',
      bar: 'bg-green-500',
    },
    purple: {
      bg: 'bg-purple-500/10',
      icon: 'text-purple-500',
      bar: 'bg-purple-500',
    },
    blue: {
      bg: 'bg-blue-500/10',
      icon: 'text-blue-500',
      bar: 'bg-blue-500',
    },
  };

  const c = colorMap[color];

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(value / 100)}
          </p>
        </div>
      </div>
      {/* Mini progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hover-bg)]">
        <div
          className={`h-full rounded-full ${c.bar} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
