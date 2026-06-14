import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { Modal, DateInput, useToast } from '@/components/ui';
import { subscriptionsService } from '@/services/subscriptions';
import { getApiErrorMessage } from '@/hooks';
import { formatCurrency } from '@/utils/format';
import type { Client, SubscriptionPlan } from '@/types';

// Término padrão/limite: hoje + 1 mês (yyyy-mm-dd).
function plusOneMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Concede uma assinatura CORTESIA (grátis) a um cliente: escolhe o plano e o dia de
 * término (limite 1 mês). Sem cobrança. Usado no menu de ações da tela de clientes
 * (admin). Quando a cortesia vence, o cliente vê o fluxo normal de renovação PAGA.
 */
export function GrantSubscriptionModal({
  isOpen,
  client,
  onClose,
  onGranted,
}: {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  onGranted: () => void;
}) {
  const toast = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [endDate, setEndDate] = useState(plusOneMonthIso());
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPlanId('');
    setEndDate(plusOneMonthIso());
    setLoadingPlans(true);
    subscriptionsService
      .listPlans()
      .then((p) => setPlans(p.filter((x) => x.isActive !== false)))
      .catch(() => toast.error('Erro', 'Não foi possível carregar os planos.'))
      .finally(() => setLoadingPlans(false));
    // toast é estável; rodar só quando o modal abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const maxIso = plusOneMonthIso();
  const tooLate = !!endDate && endDate > maxIso;
  const notFuture = !!endDate && endDate <= todayIso;
  const valid = !!planId && !!endDate && !tooLate && !notFuture;

  const handleSubmit = async () => {
    if (!client || !valid) return;
    setLoading(true);
    try {
      await subscriptionsService.grantCourtesy({ clientId: client.id, planId, endDate });
      toast.success('Assinatura concedida', `${client.name} recebeu a assinatura cortesia.`);
      onGranted();
      onClose();
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conceder assinatura (cortesia)">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          {client
            ? `${client.name} ganhará uma assinatura grátis. Sem cobrança — quando terminar, o cliente poderá renovar pagando.`
            : ''}
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Plano
          </label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={loadingPlans}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none disabled:opacity-50"
          >
            <option value="">{loadingPlans ? 'Carregando...' : 'Selecione um plano'}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.price)} ({p.cutsPerMonth} cortes/mês)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Término (máximo 1 mês)
          </label>
          <DateInput value={endDate} onChange={setEndDate} />
          {tooLate && (
            <p className="mt-1 text-xs text-[#A63030]">A cortesia tem limite de 1 mês.</p>
          )}
          {notFuture && (
            <p className="mt-1 text-xs text-[#A63030]">Escolha uma data futura.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || loading}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50"
          >
            <Gift className="h-4 w-4" />
            {loading ? 'Concedendo...' : 'Conceder'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
