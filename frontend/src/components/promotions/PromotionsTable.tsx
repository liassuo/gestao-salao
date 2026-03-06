import { Pencil, Trash2, Copy, Tag } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { Promotion } from '@/types';

interface PromotionsTableProps {
  promotions: Promotion[];
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
  onClone: (promotion: Promotion) => void;
  onToggleActive: (promotion: Promotion) => void;
  onNewPromotion: () => void;
  isLoading: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativa', color: 'bg-green-500/20 text-green-400' },
  SCHEDULED: { label: 'Agendada', color: 'bg-blue-500/20 text-blue-400' },
  EXPIRED: { label: 'Expirada', color: 'bg-gray-500/20 text-gray-400' },
  DISABLED: { label: 'Desativada', color: 'bg-red-500/20 text-red-400' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function PromotionsTable({
  promotions,
  onEdit,
  onDelete,
  onClone,
  onToggleActive,
  onNewPromotion,
  isLoading,
}: PromotionsTableProps) {
  if (promotions.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="Nenhuma promocao encontrada"
        description="Crie sua primeira promocao para atrair mais clientes."
        action={{ label: 'Nova Promocao', onClick: onNewPromotion }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Promocao
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Desconto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Periodo
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Itens
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Acoes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {promotions.map((promo) => {
            const statusInfo = statusLabels[promo.status] || statusLabels.DISABLED;
            const isOn = promo.isActive;
            return (
              <tr key={promo.id} className="bg-[var(--card-bg)] transition-colors hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {promo.bannerImageUrl ? (
                      <img
                        src={promo.bannerImageUrl}
                        alt={promo.name}
                        className="h-10 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-[#C8923A]/20">
                        <Tag className="h-5 w-5 text-[#C8923A]" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{promo.name}</p>
                      {promo.isTemplate && (
                        <span className="text-xs text-[#C8923A]">Modelo</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-[#C8923A]/20 px-2 py-1 text-sm font-semibold text-[#C8923A]">
                    {promo.discountPercent}%
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {promo.services.slice(0, 2).map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md bg-[var(--hover-bg)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {s.name}
                      </span>
                    ))}
                    {promo.products?.slice(0, 2).map((p) => (
                      <span
                        key={p.id}
                        className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400"
                      >
                        {p.name}
                      </span>
                    ))}
                    {(promo.services.length + (promo.products?.length || 0)) > 4 && (
                      <span className="rounded-md bg-[var(--hover-bg)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                        +{promo.services.length + (promo.products?.length || 0) - 4}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {/* Toggle ativo/desativado */}
                    <button
                      onClick={() => onToggleActive(promo)}
                      disabled={isLoading}
                      title={isOn ? 'Desativar promocao' : 'Ativar promocao'}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)]"
                    >
                      <div
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          isOn ? 'bg-green-500' : 'bg-zinc-600'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            isOn ? 'translate-x-[18px]' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </button>
                    <button
                      onClick={() => onClone(promo)}
                      title="Duplicar promocao"
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit(promo)}
                      title="Editar"
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(promo)}
                      disabled={isLoading}
                      title="Excluir"
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-[#C45050]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
