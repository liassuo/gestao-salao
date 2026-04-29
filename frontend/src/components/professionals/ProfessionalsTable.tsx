import { UserCog, MoreVertical, Edit2, Trash2, KeyRound, CalendarDays } from 'lucide-react';
import { useState, useRef } from 'react';
import { EmptyState } from '@/components/ui';
import type { Professional } from '@/types';
import { weekDayShortLabels } from '@/types';

interface ProfessionalsTableProps {
  professionals: Professional[];
  onEdit: (professional: Professional) => void;
  onDelete: (professional: Professional) => void;
  onResetPassword?: (professional: Professional) => void;
  onManageVacations?: (professional: Professional) => void;
  isLoading?: boolean;
  onNewProfessional?: () => void;
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
  onResetPassword,
  onManageVacations,
  isLoading,
  onNewProfessional,
}: ProfessionalsTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Profissional
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Serviços
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Dias de Trabalho
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {professionals.map((professional) => (
              <tr key={professional.id} className="hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8923A]/20 text-[#C8923A] overflow-hidden">
                      {professional.avatarUrl ? (
                        <img src={professional.avatarUrl} alt={professional.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium">
                          {professional.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-[var(--text-primary)]">{professional.name}</p>
                        {professional.currentVacation && (
                          <span
                            title={`Volta em ${professional.currentVacation.endDate.split('-').reverse().join('/')}`}
                            className="text-[10px] font-bold uppercase tracking-wider bg-[#C8923A] text-[#1c1006] px-1.5 py-0.5 rounded"
                          >
                            em férias
                          </span>
                        )}
                      </div>
                      {professional.commissionRate && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Comissão: {professional.commissionRate}%
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {professional.services && professional.services.length > 0 ? (
                      professional.services.slice(0, 3).map((service) => (
                        <span
                          key={service.id}
                          className="inline-block rounded bg-[#C8923A]/20 px-2 py-0.5 text-xs text-[#D4A85C]"
                        >
                          {service.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">Nenhum serviço</span>
                    )}
                    {professional.services && professional.services.length > 3 && (
                      <span className="inline-block rounded bg-zinc-500/20 px-2 py-0.5 text-xs text-zinc-400">
                        +{professional.services.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text-secondary)]">
                  {formatWorkingDays(professional.workingHours)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <div className="relative inline-block">
                    <button
                      ref={(el) => { menuBtnRefs.current[professional.id] = el; }}
                      onClick={() => {
                        if (openMenuId === professional.id) {
                          setOpenMenuId(null);
                        } else {
                          const btn = menuBtnRefs.current[professional.id];
                          if (btn) {
                            const rect = btn.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 });
                          }
                          setOpenMenuId(professional.id);
                        }
                      }}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === professional.id && (
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
                              onEdit(professional);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          {onManageVacations && (
                            <button
                              onClick={() => {
                                onManageVacations(professional);
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                            >
                              <CalendarDays className="h-4 w-4" />
                              Gerenciar férias
                            </button>
                          )}
                          {onResetPassword && (
                            <button
                              onClick={() => {
                                onResetPassword(professional);
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#C8923A] hover:bg-[#C8923A]/10"
                            >
                              <KeyRound className="h-4 w-4" />
                              Resetar Senha
                            </button>
                          )}
                          <button
                            onClick={() => {
                              onDelete(professional);
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
