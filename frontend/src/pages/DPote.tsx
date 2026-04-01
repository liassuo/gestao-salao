import { useState } from 'react';
import { PieChart, Users, Hash, DollarSign, Percent } from 'lucide-react';
import { usePoteReport, useActiveBranches } from '@/hooks';
import { SkeletonTable } from '@/components/ui';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function DPote() {
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const { data: branches } = useActiveBranches();
  const [branchId, setBranchId] = useState<string>('');

  const { data: report, isLoading } = usePoteReport(startDate, endDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
          <PieChart className="h-5 w-5 text-[#C8923A]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">D'Pote</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Distribuição do pote de assinaturas entre os profissionais
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Data Inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Data Final</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
          />
        </div>
        {branches && branches.length > 1 && (
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Filial</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
            >
              <option value="">Todas as filiais</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : report ? (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard
              icon={Hash}
              label="Serviços Realizados"
              value={String(report.totalServices)}
            />
            <SummaryCard
              icon={PieChart}
              label="Total de Fichas"
              value={String(report.totalFichas)}
            />
            <SummaryCard
              icon={Users}
              label="Assinaturas Ativas"
              value={String(report.activeSubscriptions)}
            />
            <SummaryCard
              icon={DollarSign}
              label="Valor do Pote"
              value={formatCurrency(report.totalSubscriptionValue)}
              highlight
            />
          </div>

          {/* Tabela por profissional */}
          <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
            <div className="border-b border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Distribuição por Profissional</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Profissional</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Serviços</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Fichas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">%</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Parte do Pote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Comissão ({report.byProfessional[0]?.commissionRate || 50}%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {report.byProfessional.map((prof: any) => (
                    <tr key={prof.professionalId} className="hover:bg-[var(--hover-bg)]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{prof.professionalName}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {prof.services.map((s: any) => `${s.name}: ${s.count}`).join(' | ')}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                        {prof.services.reduce((sum: number, s: any) => sum + s.count, 0)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                        {prof.fichas}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                        {prof.percentage.toFixed(1)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                        {formatCurrency(prof.shareOfPot)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                        {formatCurrency(prof.commission)}
                      </td>
                    </tr>
                  ))}
                  {report.byProfessional.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                        Nenhum atendimento de assinatura encontrado no período
                      </td>
                    </tr>
                  )}
                </tbody>
                {report.byProfessional.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[var(--border-color)] bg-[var(--hover-bg)]">
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Total</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                        {report.totalServices}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                        {report.totalFichas}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">100%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrency(report.totalSubscriptionValue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrency(report.byProfessional.reduce((sum: number, p: any) => sum + p.commission, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-16">
          <PieChart className="mb-3 h-10 w-10 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Selecione um período para visualizar o relatório do pote</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-[#C8923A]/30 bg-[#C8923A]/10' : 'border-[var(--border-color)] bg-[var(--card-bg)]'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${highlight ? 'text-[#C8923A]' : 'text-[var(--text-muted)]'}`} />
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-bold ${highlight ? 'text-[#C8923A]' : 'text-[var(--text-primary)]'}`}>{value}</p>
    </div>
  );
}
