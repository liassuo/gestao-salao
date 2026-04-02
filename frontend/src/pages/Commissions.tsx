import { useState } from 'react';
import { Percent, Download, DollarSign, Scissors, PieChart, Package, Clock, CheckCircle, Building2, Users } from 'lucide-react';
import {
  useCommissions,
  useGenerateCommissions,
  useMarkCommissionAsPaid,
  useDeleteCommission,
  getApiErrorMessage,
} from '@/hooks';
import { CommissionFilters } from '@/components/financial/CommissionFilters';
import { CommissionsTable } from '@/components/financial/CommissionsTable';
import { SkeletonTable, ConfirmModal, useToast } from '@/components/ui';
import { PinGate } from '@/components/auth';
import { formatCurrency } from '@/utils/format';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Commission, CommissionFilters as CommissionFiltersType } from '@/types';

function formatDateBR(date: string): string {
  const clean = date.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(clean) ? new Date(clean + 'T12:00:00') : new Date(clean);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

function calcBase(commissionAmount: number, rate: number): number {
  return rate > 0 ? Math.round((commissionAmount * 100) / rate) : 0;
}

function calcTotals(commissions: Commission[]) {
  let totalComServices = 0, totalComSub = 0, totalComProducts = 0;
  let totalBaseServices = 0, totalBaseSub = 0, totalBaseProducts = 0;

  for (const c of commissions) {
    const rate = c.professional?.commissionRate ?? 0;
    totalComServices += c.amountServices ?? 0;
    totalComSub += c.amountSubscription ?? 0;
    totalComProducts += c.amountProducts ?? 0;
    totalBaseServices += calcBase(c.amountServices ?? 0, rate);
    totalBaseSub += calcBase(c.amountSubscription ?? 0, rate);
    totalBaseProducts += calcBase(c.amountProducts ?? 0, rate);
  }

  const totalCommission = totalComServices + totalComSub + totalComProducts;
  const totalBase = totalBaseServices + totalBaseSub + totalBaseProducts;
  const totalBarbearia = totalBase - totalCommission;
  const totalPending = commissions.filter((c) => c.status === 'PENDING').reduce((s, c) => s + c.amount, 0);
  const totalPaid = commissions.filter((c) => c.status === 'PAID').reduce((s, c) => s + c.amount, 0);

  return {
    totalBase, totalBarbearia, totalCommission,
    totalComServices, totalComSub, totalComProducts,
    totalBaseServices, totalBaseSub, totalBaseProducts,
    totalPending, totalPaid,
  };
}

function exportCommissionsPDF(commissions: Commission[], filters: CommissionFiltersType) {
  if (commissions.length === 0) return;

  const doc = new jsPDF();
  const gold: [number, number, number] = [139, 105, 20];
  const t = calcTotals(commissions);

  // Header
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text('Relatorio de Comissoes', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  const periodo = filters.startDate && filters.endDate
    ? `Periodo: ${formatDateBR(filters.startDate)} a ${formatDateBR(filters.endDate)}`
    : 'Todos os periodos';
  doc.text(periodo, 14, 26);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 32);

  // Funil de valores
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Funil de Valores', 14, 42);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    startY: 46,
    head: [['Etapa', 'Serv. Avulsos', 'Serv. Assinatura', 'Produtos', 'Total']],
    body: [
      ['Faturamento Bruto', formatCurrency(t.totalBaseServices), formatCurrency(t.totalBaseSub), formatCurrency(t.totalBaseProducts), formatCurrency(t.totalBase)],
      ['Parte da Barbearia', formatCurrency(t.totalBaseServices - t.totalComServices), formatCurrency(t.totalBaseSub - t.totalComSub), formatCurrency(t.totalBaseProducts - t.totalComProducts), formatCurrency(t.totalBarbearia)],
      ['Parte dos Profissionais', formatCurrency(t.totalComServices), formatCurrency(t.totalComSub), formatCurrency(t.totalComProducts), formatCurrency(t.totalCommission)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: gold },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Pendente: ${formatCurrency(t.totalPending)}  |  Pago: ${formatCurrency(t.totalPaid)}`, 14, y);

  // Detalhamento por profissional
  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento por Profissional', 14, y);
  doc.setFont('helvetica', 'normal');

  const rows = commissions.map((c) => {
    const rate = c.professional?.commissionRate ?? 0;
    const base = calcBase(c.amountServices ?? 0, rate) + calcBase(c.amountSubscription ?? 0, rate) + calcBase(c.amountProducts ?? 0, rate);
    const barb = base - c.amount;
    return [
      c.professional?.name || '',
      `${rate}%`,
      `${formatDateBR(c.periodStart)} a ${formatDateBR(c.periodEnd)}`,
      formatCurrency(base),
      formatCurrency(barb),
      formatCurrency(c.amount),
      c.status === 'PAID' ? 'Pago' : 'Pendente',
    ];
  });

  rows.push(['TOTAL', '', '', formatCurrency(t.totalBase), formatCurrency(t.totalBarbearia), formatCurrency(t.totalCommission), '']);

  autoTable(doc, {
    startY: y + 4,
    head: [['Profissional', 'Taxa', 'Periodo', 'Faturamento', 'Barbearia', 'Profissional', 'Status']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: gold },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`comissoes-${filters.startDate || 'all'}-${filters.endDate || 'all'}.pdf`);
}

function CommissionsContent() {
  const [filters, setFilters] = useState<CommissionFiltersType>({});
  const [payingCommission, setPayingCommission] = useState<Commission | null>(null);
  const [deletingCommission, setDeletingCommission] = useState<Commission | null>(null);

  const { data: commissions, isLoading: isLoadingCommissions } = useCommissions(filters);
  const generateCommissions = useGenerateCommissions();
  const markAsPaid = useMarkCommissionAsPaid();
  const deleteCommission = useDeleteCommission();
  const toast = useToast();

  const handleGenerate = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast.error('Erro', 'Selecione a data inicial e final para gerar comissões.');
      return;
    }
    try {
      await generateCommissions.mutateAsync({
        periodStart: filters.startDate,
        periodEnd: filters.endDate,
        branchId: filters.branchId,
      });
      toast.success('Comissões geradas', 'As comissões foram calculadas com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payingCommission) return;
    try {
      await markAsPaid.mutateAsync(payingCommission.id);
      setPayingCommission(null);
      toast.success('Comissão paga', 'A comissão foi marcada como paga.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingCommission) return;
    try {
      await deleteCommission.mutateAsync(deletingCommission.id);
      setDeletingCommission(null);
      toast.success('Comissão excluída', 'A comissão foi excluída com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const list = commissions || [];
  const t = calcTotals(list);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <Percent className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Comissões</h1>
            <p className="text-sm text-[var(--text-muted)]">Gerencie as comissões dos profissionais</p>
          </div>
        </div>
        {list.length > 0 && (
          <button
            onClick={() => exportCommissionsPDF(list, filters)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)]"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        )}
      </div>

      {/* Filtros */}
      <CommissionFilters
        filters={filters}
        onChange={setFilters}
        onGenerate={handleGenerate}
        isGenerating={generateCommissions.isPending}
      />

      {/* Funil de valores */}
      {list.length > 0 && (
        <>
          {/* Linha 1: Funil principal */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FunnelCard icon={DollarSign} label="Faturamento Bruto" value={formatCurrency(t.totalBase)} sub="Receita total gerada" color="default" />
            <FunnelCard icon={Building2} label="Parte da Barbearia" value={formatCurrency(t.totalBarbearia)} sub={`${t.totalBase > 0 ? Math.round((t.totalBarbearia / t.totalBase) * 100) : 0}% do faturamento`} color="gold" />
            <FunnelCard icon={Users} label="Parte dos Profissionais" value={formatCurrency(t.totalCommission)} sub={`${t.totalBase > 0 ? Math.round((t.totalCommission / t.totalBase) * 100) : 0}% do faturamento`} color="green" />
          </div>

          {/* Linha 2: Detalhamento por fonte */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SummaryCard icon={Scissors} label="Serv. Avulsos" value={formatCurrency(t.totalComServices)} sub={`Base: ${formatCurrency(t.totalBaseServices)}`} />
            <SummaryCard icon={PieChart} label="Serv. Assinatura" value={formatCurrency(t.totalComSub)} sub={`Base: ${formatCurrency(t.totalBaseSub)}`} />
            <SummaryCard icon={Package} label="Produtos" value={formatCurrency(t.totalComProducts)} sub={`Base: ${formatCurrency(t.totalBaseProducts)}`} />
            <SummaryCard icon={Clock} label="Pendente" value={formatCurrency(t.totalPending)} variant="warning" />
            <SummaryCard icon={CheckCircle} label="Pago" value={formatCurrency(t.totalPaid)} variant="success" />
          </div>
        </>
      )}

      {/* Tabela */}
      {isLoadingCommissions ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <CommissionsTable
          commissions={list}
          onMarkAsPaid={setPayingCommission}
          onDelete={setDeletingCommission}
          isLoading={markAsPaid.isPending || deleteCommission.isPending}
        />
      )}

      <ConfirmModal
        isOpen={!!payingCommission}
        onClose={() => setPayingCommission(null)}
        onConfirm={handleMarkAsPaid}
        title="Confirmar Pagamento"
        message={`Deseja marcar a comissão de "${payingCommission?.professional?.name || 'Profissional'}" como paga?`}
        confirmLabel="Pagar"
        variant="info"
        isLoading={markAsPaid.isPending}
      />
      <ConfirmModal
        isOpen={!!deletingCommission}
        onClose={() => setDeletingCommission(null)}
        onConfirm={handleDelete}
        title="Excluir Comissão"
        message={`Tem certeza que deseja excluir a comissão de "${deletingCommission?.professional.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteCommission.isPending}
      />
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

function SummaryCard({ icon: Icon, label, value, sub, variant }: {
  icon: any; label: string; value: string; sub?: string; variant?: 'warning' | 'success';
}) {
  const colors = variant === 'warning'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    : variant === 'success'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
    : 'border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]';
  const iconColor = variant === 'warning' ? 'text-amber-500' : variant === 'success' ? 'text-emerald-500' : 'text-[var(--text-muted)]';

  return (
    <div className={`rounded-xl border p-4 ${colors}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

export function Commissions() {
  return (
    <PinGate description="Digite o PIN para acessar a gestão de comissões.">
      <CommissionsContent />
    </PinGate>
  );
}
