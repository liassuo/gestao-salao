import { useState } from 'react';
import {
  Wallet,
  ChevronDown,
  ChevronUp,
  Banknote,
  Smartphone,
  CreditCard,
  Clock,
} from 'lucide-react';
import { CashRegisterStatusBadge } from './CashRegisterStatusBadge';
import { EmptyState } from '@/components/ui';
import type { CashRegister } from '@/types';

interface CashRegisterTableProps {
  cashRegisters: CashRegister[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function parseLocalDate(dateStr: string): Date {
  const clean = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(clean + 'T12:00:00');
  }
  return new Date(clean);
}

function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDateLong(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function formatTime(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CashRegisterTable({ cashRegisters }: CashRegisterTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (cashRegisters.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nenhum registro de caixa"
        description="O historico aparecera aqui apos abrir e fechar o caixa."
      />
    );
  }

  return (
    <div className="space-y-2">
      {cashRegisters.map((cr) => {
        const isExpanded = expandedId === cr.id;
        const discColor =
          cr.discrepancy > 0
            ? 'text-amber-500'
            : cr.discrepancy < 0
            ? 'text-[#A63030]'
            : 'text-green-500';

        return (
          <div
            key={cr.id}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden transition-all"
          >
            {/* Row principal - clicável */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : cr.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--hover-bg)] transition-colors text-left"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="hidden sm:block">
                  <CashRegisterStatusBadge isOpen={cr.isOpen} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {formatDate(cr.date)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" />
                    {formatTime(cr.openedAt)}
                    {cr.closedAt && ` - ${formatTime(cr.closedAt)}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {formatCurrency(cr.totalRevenue)}
                  </p>
                  {cr.closedAt && cr.discrepancy !== 0 && (
                    <p className={`text-xs font-medium ${discColor}`}>
                      {cr.discrepancy > 0 ? '+' : ''}
                      {formatCurrency(cr.discrepancy)}
                    </p>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                )}
              </div>
            </button>

            {/* Detalhes expandidos */}
            {isExpanded && (
              <div className="border-t border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {formatDateLong(cr.date)}
                </p>

                {/* Grid de métodos */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--card-bg)] p-3">
                    <Banknote className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">Dinheiro</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {formatCurrency(cr.totalCash)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--card-bg)] p-3">
                    <Smartphone className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">PIX</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {formatCurrency(cr.totalPix)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--card-bg)] p-3">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">Cartão</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {formatCurrency(cr.totalCard)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detalhes do caixa */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-[var(--card-bg)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Saldo inicial</p>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {formatCurrency(cr.openingBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--card-bg)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Saldo final</p>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {cr.closingBalance !== undefined ? formatCurrency(cr.closingBalance) : '-'}
                    </p>
                  </div>
                </div>

                {/* Discrepância */}
                {cr.closedAt && (
                  <div
                    className={`flex items-center justify-between rounded-lg p-3 ${
                      cr.discrepancy > 0
                        ? 'bg-amber-500/10'
                        : cr.discrepancy < 0
                        ? 'bg-red-500/10'
                        : 'bg-green-500/10'
                    }`}
                  >
                    <span className={`text-sm font-medium ${discColor}`}>
                      {cr.discrepancy > 0
                        ? 'Sobra'
                        : cr.discrepancy < 0
                        ? 'Falta'
                        : 'Caixa conferido'}
                    </span>
                    <span className={`text-sm font-bold ${discColor}`}>
                      {cr.discrepancy !== 0 && (cr.discrepancy > 0 ? '+' : '')}
                      {formatCurrency(cr.discrepancy)}
                    </span>
                  </div>
                )}

                {/* Notas */}
                {cr.notes && (
                  <div className="rounded-lg bg-[var(--card-bg)] p-3">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Observações</p>
                    <p className="text-sm text-[var(--text-secondary)]">{cr.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
