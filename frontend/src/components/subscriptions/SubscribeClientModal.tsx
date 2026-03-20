import { useState } from 'react';
import { AlertCircle, Loader2, X, Search } from 'lucide-react';
import { formatPhone } from '@/utils/format';
import type { Client, SubscriptionPlan, SubscribeClientPayload } from '@/types';

interface SubscribeClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SubscribeClientPayload) => Promise<void>;
  clients: Client[];
  plans: SubscriptionPlan[];
  isLoading: boolean;
  error: string | null;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function SubscribeClientModal({
  isOpen,
  onClose,
  onSubmit,
  clients,
  plans,
  isLoading,
  error,
}: SubscribeClientModalProps) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  if (!isOpen) return null;

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.phone.includes(clientSearch)
  );

  const activePlans = plans.filter((plan) => plan.isActive);

  const selectedPlan = activePlans.find((p) => p.id === selectedPlanId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId || !selectedPlanId) return;

    await onSubmit({
      clientId: selectedClientId,
      planId: selectedPlanId,
    });

    // Reset form
    setSelectedClientId('');
    setSelectedPlanId('');
    setClientSearch('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Nova Assinatura
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Cliente */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Cliente *
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
              />
            </div>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
              required
            >
              <option value="">Selecione um cliente</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} - {formatPhone(client.phone)}
                </option>
              ))}
            </select>
          </div>

          {/* Plano */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Plano *
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
              required
            >
              <option value="">Selecione um plano</option>
              {activePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(plan.price)}/mês ({plan.cutsPerMonth === 99 ? 'Ilimitado' : `${plan.cutsPerMonth} cortes`})
                </option>
              ))}
            </select>
          </div>

          {/* Resumo do Plano */}
          {selectedPlan && (
            <div className="mb-6 rounded-xl bg-[var(--hover-bg)] p-4">
              <h3 className="mb-2 font-medium text-[var(--text-primary)]">
                Resumo do Plano
              </h3>
              <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                <p><span className="font-medium">Plano:</span> {selectedPlan.name}</p>
                <p><span className="font-medium">Valor:</span> {formatCurrency(selectedPlan.price)}/mês</p>
                <p><span className="font-medium">Cortes:</span> {selectedPlan.cutsPerMonth === 99 ? 'Ilimitados' : `${selectedPlan.cutsPerMonth} por mês`}</p>
                {selectedPlan.description && (
                  <p><span className="font-medium">Descrição:</span> {selectedPlan.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Botoes */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedClientId || !selectedPlanId}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Salvando...' : 'Confirmar Assinatura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
