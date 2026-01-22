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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Abertura
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Fechamento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Receita Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Discrepância
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cashRegisters.map((cr) => (
              <tr key={cr.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                  {formatDate(cr.date)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {formatTime(cr.openedAt)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {cr.closedAt ? formatTime(cr.closedAt) : '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {formatCurrency(cr.totalRevenue)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {cr.closedAt ? (
                    <span
                      className={`font-medium ${
                        cr.discrepancy > 0
                          ? 'text-green-600'
                          : cr.discrepancy < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
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
