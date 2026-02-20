import { useState } from 'react';
import { Percent } from 'lucide-react';
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
import type { Commission, CommissionFilters as CommissionFiltersType } from '@/types';

export function Commissions() {
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
      toast.error('Erro', 'Selecione a data inicial e final para gerar comissoes.');
      return;
    }
    try {
      await generateCommissions.mutateAsync({
        periodStart: filters.startDate,
        periodEnd: filters.endDate,
        branchId: filters.branchId,
      });
      toast.success('Comissoes geradas', 'As comissoes foram calculadas com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payingCommission) return;
    try {
      await markAsPaid.mutateAsync(payingCommission.id);
      setPayingCommission(null);
      toast.success('Comissao paga', 'A comissao foi marcada como paga.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingCommission) return;
    try {
      await deleteCommission.mutateAsync(deletingCommission.id);
      setDeletingCommission(null);
      toast.success('Comissao excluida', 'A comissao foi excluida com sucesso.');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
          <Percent className="h-5 w-5 text-[#C8923A]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Comissoes</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Gerencie as comissoes dos profissionais
          </p>
        </div>
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
        message={`Deseja marcar a comissao de "${payingCommission?.professional?.name || 'Profissional'}" como paga?`}
        confirmLabel="Pagar"
        variant="info"
        isLoading={markAsPaid.isPending}
      />

      {/* Modal Confirmar Exclusao */}
      <ConfirmModal
        isOpen={!!deletingCommission}
        onClose={() => setDeletingCommission(null)}
        onConfirm={handleDelete}
        title="Excluir Comissao"
        message={`Tem certeza que deseja excluir a comissao de "${deletingCommission?.professional.name}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteCommission.isPending}
      />
    </div>
  );
}
