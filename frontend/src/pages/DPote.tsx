import { useState } from 'react';
import { PieChart, Users, Hash, DollarSign, Download, Building2 } from 'lucide-react';
import { usePoteReport, useActiveBranches } from '@/hooks';
import { SkeletonTable, PeriodShortcuts } from '@/components/ui';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDateBR(date: string): string {
  const clean = date.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(clean) ? new Date(clean + 'T12:00:00') : new Date(clean);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

function calcDPoteTotals(report: any) {
  const totalProfissionais = report.byProfessional.reduce((s: number, p: any) => s + p.commission, 0);
  const totalBarbearia = report.byProfessional.reduce((s: number, p: any) => s + (p.shareOfPot - p.commission), 0);
  return { totalProfissionais, totalBarbearia };
}

function exportDPotePDF(report: any, startDate: string, endDate: string) {
  if (!report || report.byProfessional.length === 0) return;

  const doc = new jsPDF();
  const gold: [number, number, number] = [139, 105, 20];
  const { totalProfissionais, totalBarbearia } = calcDPoteTotals(report);

  // Header
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text("Relatorio D'Pote", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Periodo: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`, 14, 26);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 32);

  // Funil de valores
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Funil de Valores', 14, 42);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    startY: 46,
    head: [['Etapa', 'Valor', '% do Pote']],
    body: [
      ['Valor do Pote (soma das assinaturas)', formatCurrency(report.totalSubscriptionValue), '100%'],
      ['Parte da Barbearia', formatCurrency(totalBarbearia), report.totalSubscriptionValue > 0 ? `${Math.round((totalBarbearia / report.totalSubscriptionValue) * 100)}%` : '0%'],
      ['Parte dos Profissionais (comissoes)', formatCurrency(totalProfissionais), report.totalSubscriptionValue > 0 ? `${Math.round((totalProfissionais / report.totalSubscriptionValue) * 100)}%` : '0%'],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: gold },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
    tableWidth: 140,
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Servicos realizados: ${report.totalServices}  |  Total fichas: ${report.totalFichas}  |  Assinaturas ativas: ${report.activeSubscriptions}`, 14, y);

  // Distribuicao por profissional
  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribuicao por Profissional', 14, y);
  doc.setFont('helvetica', 'normal');

  const rows = report.byProfessional.map((prof: any) => {
    const barbCut = prof.shareOfPot - prof.commission;
    const servicesCount = prof.services.reduce((s: number, sv: any) => s + sv.count, 0);
    return [
      prof.professionalName,
      `${prof.commissionRate}%`,
      servicesCount,
      prof.fichas,
      prof.percentage.toFixed(1) + '%',
      formatCurrency(prof.shareOfPot),
      formatCurrency(barbCut),
      formatCurrency(prof.commission),
    ];
  });

  rows.push(['TOTAL', '', report.totalServices, report.totalFichas, '100%', formatCurrency(report.totalSubscriptionValue), formatCurrency(totalBarbearia), formatCurrency(totalProfissionais)]);

  autoTable(doc, {
    startY: y + 4,
    head: [['Profissional', 'Taxa', 'Servicos', 'Fichas', '%', 'Parte do Pote', 'Barbearia', 'Profissional']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: gold },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Detalhamento de servicos
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento de Servicos por Profissional', 14, y);
  doc.setFont('helvetica', 'normal');

  const detailRows: any[] = [];
  for (const prof of report.byProfessional) {
    for (const svc of prof.services) {
      detailRows.push([prof.professionalName, svc.name, svc.count, svc.fichas]);
    }
  }

  if (detailRows.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [['Profissional', 'Servico', 'Qtd', 'Fichas']],
      body: detailRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: gold },
    });
  }

  doc.save(`dpote-${startDate}-${endDate}.pdf`);
}

export function DPote() {
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(todayStr);
  const { data: branches } = useActiveBranches();
  const [branchId, setBranchId] = useState<string>('');

  const { data: report, isLoading } = usePoteReport(startDate, endDate);

  const totals = report?.byProfessional?.length ? calcDPoteTotals(report) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <PieChart className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">D'Pote</h1>
            <p className="text-sm text-[var(--text-muted)]">Distribuição do pote de assinaturas entre os profissionais</p>
          </div>
        </div>
        {report && report.byProfessional.length > 0 && (
          <button
            onClick={() => exportDPotePDF(report, startDate, endDate)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)]"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Data Inicial</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Data Final</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]" />
        </div>
        {branches && branches.length > 1 && (
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Filial</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]">
              <option value="">Todas as filiais</option>
              {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
        )}
        <div className="w-full">
          <PeriodShortcuts onSelect={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : report ? (
        <>
          {/* Funil principal */}
          {totals && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FunnelCard
                icon={DollarSign}
                label="Valor do Pote"
                value={formatCurrency(report.totalSubscriptionValue)}
                sub={`${report.activeSubscriptions} assinaturas ativas`}
                color="default"
              />
              <FunnelCard
                icon={Building2}
                label="Parte da Barbearia"
                value={formatCurrency(totals.totalBarbearia)}
                sub={`${report.totalSubscriptionValue > 0 ? Math.round((totals.totalBarbearia / report.totalSubscriptionValue) * 100) : 0}% do pote`}
                color="gold"
              />
              <FunnelCard
                icon={Users}
                label="Parte dos Profissionais"
                value={formatCurrency(totals.totalProfissionais)}
                sub={`${report.totalSubscriptionValue > 0 ? Math.round((totals.totalProfissionais / report.totalSubscriptionValue) * 100) : 0}% do pote`}
                color="green"
              />
            </div>
          )}

          {/* Cards secundários */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SmallCard icon={Hash} label="Serviços Realizados" value={String(report.totalServices)} />
            <SmallCard icon={PieChart} label="Total de Fichas" value={String(report.totalFichas)} />
            <SmallCard icon={Users} label="Assinaturas Ativas" value={String(report.activeSubscriptions)} />
            <SmallCard icon={DollarSign} label="Valor por Ficha" value={report.totalFichas > 0 ? formatCurrency(Math.round(report.totalSubscriptionValue / report.totalFichas)) : 'R$ 0,00'} />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Taxa</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Serviços</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Fichas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">%</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Parte do Pote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Barbearia</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Profissional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {report.byProfessional.map((prof: any) => {
                    const barbCut = prof.shareOfPot - prof.commission;
                    return (
                      <tr key={prof.professionalId} className="hover:bg-[var(--hover-bg)]">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="font-medium text-[var(--text-primary)]">{prof.professionalName}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {prof.services.map((s: any) => `${s.name}: ${s.count} (${s.fichas} fichas)`).join(' | ')}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{prof.commissionRate}%</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{prof.services.reduce((sum: number, s: any) => sum + s.count, 0)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{prof.fichas}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{prof.percentage.toFixed(1)}%</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">{formatCurrency(prof.shareOfPot)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#C8923A] font-medium">{formatCurrency(barbCut)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(prof.commission)}</td>
                      </tr>
                    );
                  })}
                  {report.byProfessional.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Nenhum atendimento de assinatura encontrado no período</td></tr>
                  )}
                </tbody>
                {report.byProfessional.length > 0 && totals && (
                  <tfoot>
                    <tr className="border-t-2 border-[var(--border-color)] bg-[var(--hover-bg)]">
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Total</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{report.totalServices}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{report.totalFichas}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">100%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(report.totalSubscriptionValue)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#C8923A]">{formatCurrency(totals.totalBarbearia)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-400">{formatCurrency(totals.totalProfissionais)}</td>
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

function FunnelCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub: string; color: 'default' | 'gold' | 'green';
}) {
  const styles = {
    default: { border: 'border-[var(--border-color)]', bg: 'bg-[var(--card-bg)]', icon: 'text-[var(--text-muted)]', text: 'text-[var(--text-primary)]' },
    gold: { border: 'border-[#C8923A]/30', bg: 'bg-[#C8923A]/10', icon: 'text-[#C8923A]', text: 'text-[#C8923A]' },
    green: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: 'text-emerald-500', text: 'text-emerald-400' },
  }[color];

  return (
    <div className={`rounded-xl border p-5 ${styles.border} ${styles.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-5 w-5 ${styles.icon}`} />
        <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${styles.text}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>
    </div>
  );
}

function SmallCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
