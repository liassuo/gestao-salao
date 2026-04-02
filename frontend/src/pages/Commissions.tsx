import { useState } from 'react';
import { Percent, Download } from 'lucide-react';
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
import type { Commission, CommissionFilters as CommissionFiltersType } from '@/types';

function formatDateBR(date: string): string {
  const clean = date.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(clean) ? new Date(clean + 'T12:00:00') : new Date(clean);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

function exportCommissionsCSV(commissions: Commission[], filters: CommissionFiltersType) {
  if (commissions.length === 0) return;

  const headers = ['Profissional', 'Período Início', 'Período Fim', 'Serv. Avulsos', 'Serv. Assinatura', 'Produtos', 'Total Líquido', 'Status'];
  let csv = headers.join(';') + '\n';

  for (const c of commissions) {
    csv += [
      c.professional?.name || '',
      formatDateBR(c.periodStart),
      formatDateBR(c.periodEnd),
      formatCurrency(c.amountServices ?? 0),
      formatCurrency(c.amountSubscription ?? 0),
      formatCurrency(c.amountProducts ?? 0),
      formatCurrency(c.amount),
      c.status === 'PAID' ? 'Pago' : 'Pendente',
    ].join(';') + '\n';
  }

  const totalServices = commissions.reduce((s, c) => s + (c.amountServices ?? 0), 0);
  const totalSub = commissions.reduce((s, c) => s + (c.amountSubscription ?? 0), 0);
  const totalProducts = commissions.reduce((s, c) => s + (c.amountProducts ?? 0), 0);
  const totalAmount = commissions.reduce((s, c) => s + c.amount, 0);
  csv += ['TOTAL', '', '', formatCurrency(totalServices), formatCurrency(totalSub), formatCurrency(totalProducts), formatCurrency(totalAmount), ''].join(';') + '\n';

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comissoes-${filters.startDate || 'all'}-${filters.endDate || 'all'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie as comissões dos profissionais
            </p>
          </div>
        </div>
        {(commissions?.length ?? 0) > 0 && (
          <button
            onClick={() => exportCommissionsCSV(commissions!, filters)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)]"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
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

      {/* Tabela */}
      {isLoadingCommissions ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <CommissionsTable
          commissions={commissions || []}
          onMarkAsPaid={setPayingCommission}
          onDelete={setDeletingCommission}
          isLoading={markAsPaid.isPending || deleteCommission.isPending}
        />
      )}

      {/* Modal Confirmar Pagamento */}
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

      {/* Modal Confirmar Exclusão */}
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

export function Commissions() {
  return (
    <PinGate description="Digite o PIN para acessar a gestão de comissões.">
      <CommissionsContent />
    </PinGate>
  );
}
