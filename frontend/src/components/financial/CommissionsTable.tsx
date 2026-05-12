import { Fragment, useState } from 'react';
import { Percent, CheckCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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

interface ProfessionalGroup {
  professionalId: string;
  professionalName: string;
  items: Commission[];
  periodStart: string;
  periodEnd: string;
  amountServices: number;
  amountSubscription: number;
  amountProducts: number;
  amountDeductedDebts: number;
  amount: number;
  totalLiquido: number;
  pendingCount: number;
  paidCount: number;
}

function groupByProfessional(commissions: Commission[]): ProfessionalGroup[] {
  const map = new Map<string, ProfessionalGroup>();

  for (const c of commissions) {
    const pid = c.professional?.id ?? 'unknown';
    const pname = c.professional?.name || 'Profissional';
    const existing = map.get(pid);
    const liquido = Math.max(0, c.amount - (c.amountDeductedDebts ?? 0));

    if (!existing) {
      map.set(pid, {
        professionalId: pid,
        professionalName: pname,
        items: [c],
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        amountServices: c.amountServices ?? 0,
        amountSubscription: c.amountSubscription ?? 0,
        amountProducts: c.amountProducts ?? 0,
        amountDeductedDebts: c.amountDeductedDebts ?? 0,
        amount: c.amount,
        totalLiquido: liquido,
        pendingCount: c.status === 'PENDING' ? 1 : 0,
        paidCount: c.status === 'PAID' ? 1 : 0,
      });
    } else {
      existing.items.push(c);
      if (c.periodStart < existing.periodStart) existing.periodStart = c.periodStart;
      if (c.periodEnd > existing.periodEnd) existing.periodEnd = c.periodEnd;
      existing.amountServices += c.amountServices ?? 0;
      existing.amountSubscription += c.amountSubscription ?? 0;
      existing.amountProducts += c.amountProducts ?? 0;
      existing.amountDeductedDebts += c.amountDeductedDebts ?? 0;
      existing.amount += c.amount;
      existing.totalLiquido += liquido;
      if (c.status === 'PENDING') existing.pendingCount += 1;
      else existing.paidCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.professionalName.localeCompare(b.professionalName, 'pt-BR'));
}

function StatusBadge({ group }: { group: ProfessionalGroup }) {
  if (group.pendingCount > 0 && group.paidCount === 0) {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${commissionStatusColors.PENDING}`}>
        {commissionStatusLabels.PENDING}
        {group.items.length > 1 && ` (${group.pendingCount})`}
      </span>
    );
  }
  if (group.paidCount > 0 && group.pendingCount === 0) {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${commissionStatusColors.PAID}`}>
        {commissionStatusLabels.PAID}
        {group.items.length > 1 && ` (${group.paidCount})`}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${commissionStatusColors.PENDING}`}>
        {group.pendingCount} pend.
      </span>
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${commissionStatusColors.PAID}`}>
        {group.paidCount} pago
      </span>
    </div>
  );
}

export function CommissionsTable({ commissions, onMarkAsPaid, onDelete, isLoading }: CommissionsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (commissions.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        title="Nenhuma comissão encontrada"
        description="Não há comissões registradas. Utilize os filtros acima e clique em 'Gerar Comissões' para calcular."
      />
    );
  }

  const groups = groupByProfessional(commissions);

  const toggle = (pid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="w-8 px-2 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Profissional</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Período</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Serv. Avulsos</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Serv. Assinatura</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Produtos</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Débito</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Total Líquido</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {groups.map((group) => {
              const isOpen = expanded.has(group.professionalId);
              const hasMultiple = group.items.length > 1;
              return (
                <Fragment key={group.professionalId}>
                  <tr
                    className={`hover:bg-[var(--hover-bg)] ${hasMultiple ? 'cursor-pointer' : ''}`}
                    onClick={() => hasMultiple && toggle(group.professionalId)}
                  >
                    <td className="px-2 py-3 text-[var(--text-muted)]">
                      {hasMultiple ? (
                        isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">
                        {group.professionalName}
                        {hasMultiple && (
                          <span className="ml-2 text-xs text-[var(--text-muted)]">({group.items.length} períodos)</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                      {formatDate(group.periodStart)} - {formatDate(group.periodEnd)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{formatCurrency(group.amountServices)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{formatCurrency(group.amountSubscription)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{formatCurrency(group.amountProducts)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-red-400">
                      {group.amountDeductedDebts > 0 ? `− ${formatCurrency(group.amountDeductedDebts)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                      {formatCurrency(group.totalLiquido)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge group={group} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {!hasMultiple && (
                        <div className="flex items-center justify-end gap-2">
                          {group.items[0].status !== 'PAID' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onMarkAsPaid(group.items[0]); }}
                              disabled={isLoading}
                              className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
                              title="Marcar como pago"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(group.items[0]); }}
                            disabled={isLoading}
                            className="rounded-lg p-1.5 text-[#A63030] hover:bg-red-500/10 disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {hasMultiple && (
                        <span className="text-xs text-[var(--text-muted)]">Expandir →</span>
                      )}
                    </td>
                  </tr>

                  {hasMultiple && isOpen && group.items.map((commission) => (
                    <tr key={commission.id} className="bg-[var(--hover-bg)]/40">
                      <td className="px-2 py-2"></td>
                      <td className="whitespace-nowrap px-4 py-2 pl-8 text-xs text-[var(--text-muted)]">↳ Período</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-[var(--text-muted)]">
                        {formatDate(commission.periodStart)} - {formatDate(commission.periodEnd)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-[var(--text-muted)]">{formatCurrency(commission.amountServices ?? 0)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-[var(--text-muted)]">{formatCurrency(commission.amountSubscription ?? 0)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-[var(--text-muted)]">{formatCurrency(commission.amountProducts ?? 0)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-red-400">
                        {(commission.amountDeductedDebts ?? 0) > 0 ? `− ${formatCurrency(commission.amountDeductedDebts ?? 0)}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-[var(--text-primary)]">
                        {formatCurrency(Math.max(0, commission.amount - (commission.amountDeductedDebts ?? 0)))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${commissionStatusColors[commission.status]}`}>
                          {commissionStatusLabels[commission.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
