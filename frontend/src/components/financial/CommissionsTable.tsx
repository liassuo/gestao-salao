import { Percent, CheckCircle, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { Commission } from '@/types';
import { commissionStatusLabels, commissionStatusColors } from '@/types';

interface CommissionsTableProps {
  commissions: Commission[];
  onMarkAsPaid: (commission: Commission) => void;
  onDelete: (commission: Commission) => void;
  isLoading?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function CommissionsTable({ commissions, onMarkAsPaid, onDelete, isLoading }: CommissionsTableProps) {
  if (commissions.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        title="Nenhuma comissao encontrada"
        description="Nao ha comissoes registradas. Utilize os filtros acima e clique em 'Gerar Comissoes' para calcular."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Profissional
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Periodo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {commissions.map((commission) => (
              <tr key={commission.id} className="hover:bg-[var(--hover-bg)]">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium text-[var(--text-primary)]">
                    {commission.professional?.name || 'Profissional'}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                  {formatDate(commission.periodStart)} - {formatDate(commission.periodEnd)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                  {formatCurrency(commission.amount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${commissionStatusColors[commission.status]}`}>
                    {commissionStatusLabels[commission.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {commission.status !== 'PAID' && (
                      <button
                        onClick={() => onMarkAsPaid(commission)}
                        disabled={isLoading}
                        className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
                        title="Marcar como pago"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(commission)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[#A63030] hover:bg-red-500/10 disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
