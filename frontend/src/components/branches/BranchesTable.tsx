import { Building2, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { EmptyState } from '@/components/ui';
import { formatPhone } from '@/utils/format';
import type { Branch } from '@/types';

interface BranchesTableProps {
  branches: Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  isLoading?: boolean;
  onNewBranch?: () => void;
}

export function BranchesTable({
  branches,
  onEdit,
  onDelete,
  isLoading,
  onNewBranch,
}: BranchesTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (branches.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma filial cadastrada"
        description="Cadastre sua primeira filial para começar a organizar o negócio."
        action={onNewBranch ? { label: 'Nova Filial', onClick: onNewBranch } : undefined}
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
                Nome
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Endereço
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Telefone
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Profissionais
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {branches.map((branch) => (
              <tr key={branch.id} className="hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8923A]/20 text-[#C8923A]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <p className="font-medium text-[var(--text-primary)]">{branch.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {branch.address || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {formatPhone(branch.phone) || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {branch._count?.professionals || 0}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {branch.isActive ? (
                    <span className="inline-flex w-fit rounded-full bg-[#C8923A]/20 px-2 py-0.5 text-xs font-medium text-[#C8923A]">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex w-fit rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs font-medium text-zinc-400">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <div className="relative inline-block">
                    <button
                      ref={(el) => { menuBtnRefs.current[branch.id] = el; }}
                      onClick={() => {
                        if (openMenuId === branch.id) {
                          setOpenMenuId(null);
                        } else {
                          const btn = menuBtnRefs.current[branch.id];
                          if (btn) {
                            const rect = btn.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 });
                          }
                          setOpenMenuId(branch.id);
                        }
                      }}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === branch.id && (
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
                              onEdit(branch);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(branch);
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
