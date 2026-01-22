import { UserCog, Phone, Mail, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui';
import type { Professional } from '@/types';
import { weekDayShortLabels } from '@/types';

interface ProfessionalsTableProps {
  professionals: Professional[];
  onEdit: (professional: Professional) => void;
  onDelete: (professional: Professional) => void;
  isLoading?: boolean;
  onNewProfessional?: () => void;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function formatWorkingDays(workingHours: Professional['workingHours']): string {
  if (!workingHours || workingHours.length === 0) return 'Não definido';

  const days = workingHours
    .map((wh) => weekDayShortLabels[wh.dayOfWeek])
    .join(', ');

  return days;
}

export function ProfessionalsTable({
  professionals,
  onEdit,
  onDelete,
  isLoading,
  onNewProfessional,
}: ProfessionalsTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (professionals.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="Nenhum profissional cadastrado"
        description="Cadastre seus profissionais para começar a agendar atendimentos."
        action={onNewProfessional ? { label: 'Novo Profissional', onClick: onNewProfessional } : undefined}
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
                Profissional
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Contato
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Serviços
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Dias de Trabalho
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {professionals.map((professional) => (
              <tr key={professional.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <span className="text-sm font-medium">
                        {professional.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{professional.name}</p>
                      {professional.commissionRate && (
                        <p className="text-xs text-gray-500">
                          Comissão: {professional.commissionRate}%
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Phone className="h-3.5 w-3.5" />
                      {formatPhone(professional.phone)}
                    </div>
                    {professional.email && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[180px]">{professional.email}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {professional.services && professional.services.length > 0 ? (
                      professional.services.slice(0, 3).map((service) => (
                        <span
                          key={service.id}
                          className="inline-block rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
                        >
                          {service.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">Nenhum serviço</span>
                    )}
                    {professional.services && professional.services.length > 3 && (
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        +{professional.services.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                  {formatWorkingDays(professional.workingHours)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === professional.id ? null : professional.id)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === professional.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => {
                              onEdit(professional);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(professional);
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
