import { Wallet } from 'lucide-react';
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CashRegisterTable({ cashRegisters }: CashRegisterTableProps) {
  if (cashRegisters.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nenhum registro de caixa"
        description="Não há registros de caixa para o período selecionado. O histórico aparecerá aqui após abrir e fechar o caixa."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Abertura
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Fechamento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Receita Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Discrepância
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {cashRegisters.map((cr) => (
              <tr key={cr.id} className="hover:bg-[var(--hover-bg)]">
                <td className="whitespace-nowrap px-6 py-4 font-medium text-[var(--text-primary)]">
                  {formatDate(cr.date)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {formatTime(cr.openedAt)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {cr.closedAt ? formatTime(cr.closedAt) : '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[var(--text-primary)]">
                  {formatCurrency(cr.totalRevenue)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {cr.closedAt ? (
                    <span
                      className={`font-medium ${
                        cr.discrepancy > 0
                          ? 'text-blue-500'
                          : cr.discrepancy < 0
                          ? 'text-red-500'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {cr.discrepancy > 0 && '+'}
                      {formatCurrency(cr.discrepancy)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <CashRegisterStatusBadge isOpen={cr.isOpen} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
