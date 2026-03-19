import { Scissors, Clock, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { EmptyState } from '@/components/ui';
import type { Service } from '@/types';

interface ServicesTableProps {
  services: Service[];
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  isLoading?: boolean;
  onNewService?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function ServicesTable({
  services,
  onEdit,
  onDelete,
  isLoading,
  onNewService,
}: ServicesTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (services.length === 0) {
    return (
      <EmptyState
        icon={Scissors}
        title="Nenhum serviço cadastrado"
        description="Cadastre seus serviços para começar a oferecer aos clientes."
        action={onNewService ? { label: 'Novo Serviço', onClick: onNewService } : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Serviço
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Duração
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Preço
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8923A]/20 text-[#C8923A]">
                      <Scissors className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{service.name}</p>
                      {service.description && (
                        <p className="text-sm text-[var(--text-muted)] truncate max-w-[300px]">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <Clock className="h-4 w-4" />
                    {formatDuration(service.duration)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span className="text-lg font-semibold text-[var(--text-primary)]">
                    {formatCurrency(service.price)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <div className="relative inline-block">
                    <button
                      ref={(el) => { menuBtnRefs.current[service.id] = el; }}
                      onClick={() => {
                        if (openMenuId === service.id) {
                          setOpenMenuId(null);
                        } else {
                          const btn = menuBtnRefs.current[service.id];
                          if (btn) {
                            const rect = btn.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 });
                          }
                          setOpenMenuId(service.id);
                        }
                      }}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === service.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div
                          className="fixed z-20 w-36 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-1 shadow-lg"
                          style={{ top: menuPos.top, left: menuPos.left }}
                        >
                          <button
                            onClick={() => {
                              onEdit(service);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(service);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#A63030] hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
