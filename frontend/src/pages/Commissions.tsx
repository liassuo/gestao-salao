import { useState, useEffect } from 'react';
import { Percent, Lock, ShieldCheck } from 'lucide-react';
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
import { api } from '@/services/api';
import type { Commission, CommissionFilters as CommissionFiltersType } from '@/types';

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
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setPinRequired(!!data.hasCommissionPin);
    }).catch(() => {
      setPinRequired(false);
    });
  }, []);

  const handleVerifyPin = async () => {
    if (!pinInput) return;
    setVerifyingPin(true);
    setPinError('');
    try {
      const { data } = await api.post('/settings/verify-commission-pin', { pin: pinInput });
      if (data.valid) {
        setPinUnlocked(true);
      } else {
        setPinError('PIN incorreto. Tente novamente.');
        setPinInput('');
      }
    } catch {
      setPinError('Erro ao verificar PIN. Tente novamente.');
    } finally {
      setVerifyingPin(false);
    }
  };

  // Loading
  if (pinRequired === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8923A]" />
      </div>
    );
  }

  // No PIN configured or already unlocked
  if (!pinRequired || pinUnlocked) {
    return <CommissionsContent />;
  }

  // PIN gate
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C8923A]/20">
          <Lock className="h-8 w-8 text-[#C8923A]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Acesso Restrito</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Digite o PIN para acessar a gestão de comissões.
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Digite o PIN"
          value={pinInput}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPinInput(v);
            setPinError('');
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPin(); }}
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#C8923A] transition-colors"
        />

        {pinError && (
          <p className="mt-2 text-sm text-[#A63030]">{pinError}</p>
        )}

        <button
          onClick={handleVerifyPin}
          disabled={verifyingPin || pinInput.length < 4}
          className="mt-4 w-full py-3 bg-[#8B6914] hover:bg-[#725510] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {verifyingPin ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <ShieldCheck className="h-5 w-5" />
              Desbloquear
            </>
          )}
        </button>
      </div>
    </div>
  );
}
