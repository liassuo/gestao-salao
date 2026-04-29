import { useMemo, useState } from 'react';
import { Wallet, Plus, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import {
  useProfessionals,
  useProfessionalDebts,
  useCreateProfessionalDebt,
  useSettleProfessionalDebtCash,
  useDeleteProfessionalDebt,
  getApiErrorMessage,
} from '@/hooks';
import { Modal, SkeletonTable, useToast, ConfirmModal } from '@/components/ui';
import {
  professionalDebtStatusLabels,
  professionalDebtStatusColors,
  type ProfessionalDebt,
  type ProfessionalDebtStatus,
} from '@/types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const cents = parseInt(numbers, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value: string): number {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers, 10) || 0;
}

export function ProfessionalDebts() {
  const [professionalFilter, setProfessionalFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ProfessionalDebtStatus | ''>('PENDING');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<ProfessionalDebt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfessionalDebt | null>(null);

  const { data: professionals = [] } = useProfessionals();
  const { data: debts = [], isLoading, isError, error } = useProfessionalDebts({
    professionalId: professionalFilter || undefined,
    status: (statusFilter as ProfessionalDebtStatus) || undefined,
  });

  const createDebt = useCreateProfessionalDebt();
  const settleCash = useSettleProfessionalDebtCash();
  const deleteDebt = useDeleteProfessionalDebt();
  const toast = useToast();

  const totalPending = useMemo(
    () => debts.filter((d) => d.status === 'PENDING').reduce((s, d) => s + d.remainingBalance, 0),
    [debts],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
            <Wallet className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Débitos de Profissionais
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Consumos e adiantamentos descontados na próxima comissão
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#8B2020] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#6B1818]"
        >
          <Plus className="h-5 w-5" />
          Novo Débito
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Profissional</label>
          <select
            value={professionalFilter}
            onChange={(e) => setProfessionalFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Todos</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProfessionalDebtStatus | '')}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="DEDUCTED">Descontado em comissão</option>
            <option value="SETTLED_CASH">Quitado em dinheiro</option>
            <option value="VOIDED">Anulado</option>
          </select>
        </div>
        <div className="ml-auto flex items-end">
          <div className="rounded-lg bg-red-500/10 px-4 py-2 text-right">
            <div className="text-xs text-[var(--text-muted)]">Total pendente (filtro)</div>
            <div className="text-lg font-bold text-red-400">{formatCurrency(totalPending)}</div>
          </div>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-[#A63030]" />
            <div>
              <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
              <p className="text-sm text-[#C45050]">
                {error instanceof Error ? error.message : 'Erro inesperado.'}
              </p>
            </div>
          </div>
        </div>
      ) : debts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-40" />
          <p className="mt-3 text-[var(--text-muted)]">Nenhum débito encontrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-tertiary)] text-left text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {d.professional?.name || d.professionalId}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {d.orderId ? `Comanda #${d.orderId.slice(0, 8)}` : 'Manual'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{d.description || '—'}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(d.amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-400">
                    {formatCurrency(d.remainingBalance)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${professionalDebtStatusColors[d.status]}`}
                    >
                      {professionalDebtStatusLabels[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {d.status === 'PENDING' && (
                        <button
                          onClick={() => setSettleTarget(d)}
                          title="Quitar em dinheiro"
                          className="rounded p-1.5 text-green-400 hover:bg-green-500/10"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {d.status === 'PENDING' && !d.orderId && (
                        <button
                          onClick={() => setDeleteTarget(d)}
                          title="Excluir"
                          className="rounded p-1.5 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: novo débito manual */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Novo débito do profissional"
        size="md"
      >
        <CreateDebtForm
          professionals={professionals}
          isLoading={createDebt.isPending}
          onSubmit={async (payload) => {
            try {
              await createDebt.mutateAsync(payload);
              setIsCreateOpen(false);
              toast.success('Débito registrado', 'Será descontado na próxima comissão.');
            } catch (err) {
              toast.error('Erro', getApiErrorMessage(err));
            }
          }}
        />
      </Modal>

      {/* Modal: quitar em dinheiro */}
      <ConfirmModal
        isOpen={!!settleTarget}
        onClose={() => setSettleTarget(null)}
        onConfirm={async () => {
          if (!settleTarget) return;
          try {
            await settleCash.mutateAsync({
              id: settleTarget.id,
              payload: { method: 'CASH' },
            });
            setSettleTarget(null);
            toast.success('Débito quitado', 'Pagamento registrado no caixa.');
          } catch (err) {
            toast.error('Erro', getApiErrorMessage(err));
          }
        }}
        title="Quitar débito em dinheiro"
        message={
          settleTarget
            ? `Confirmar quitação de ${formatCurrency(settleTarget.remainingBalance)} de ${
                settleTarget.professional?.name || ''
              }? O valor será registrado no caixa como entrada.`
            : ''
        }
        confirmLabel="Quitar"
        variant="info"
        isLoading={settleCash.isPending}
      />

      {/* Modal: excluir manual */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteDebt.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            toast.success('Débito excluído', 'O lançamento foi removido.');
          } catch (err) {
            toast.error('Erro', getApiErrorMessage(err));
          }
        }}
        title="Excluir débito manual"
        message="Apenas débitos manuais pendentes podem ser excluídos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteDebt.isPending}
      />
    </div>
  );
}

interface CreateDebtFormProps {
  professionals: { id: string; name: string }[];
  isLoading: boolean;
  onSubmit: (payload: { professionalId: string; amount: number; description?: string }) => Promise<void>;
}

function CreateDebtForm({ professionals, isLoading, onSubmit }: CreateDebtFormProps) {
  const [professionalId, setProfessionalId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');

  const cents = parseCurrencyInput(amountText);
  const canSubmit = !!professionalId && cents > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        void onSubmit({
          professionalId,
          amount: cents,
          description: description.trim() || undefined,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1 block text-sm text-[var(--text-muted)]">Profissional *</label>
        <select
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="">Selecione</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--text-muted)]">Valor *</label>
        <input
          type="text"
          value={amountText}
          onChange={(e) => setAmountText(formatCurrencyInput(e.target.value))}
          placeholder="0,00"
          required
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--text-muted)]">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Vale-adiantamento, ferramenta perdida"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!canSubmit || isLoading}
          className="rounded-lg bg-[#8B2020] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B1818] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Salvando...' : 'Lançar débito'}
        </button>
      </div>
    </form>
  );
}
