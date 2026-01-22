import { Scissors, Clock, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Serviço
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Duração
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Preço
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <Scissors className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      {service.description && (
                        <p className="text-sm text-gray-500 truncate max-w-[300px]">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    {formatDuration(service.duration)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(service.price)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === service.id ? null : service.id)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === service.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => {
                              onEdit(service);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(service);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
