import { Users, Phone, Mail, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui';
import type { Client } from '@/types';

interface ClientsTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  isLoading?: boolean;
  onNewClient?: () => void;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

function formatPhone(phone: string): string {
  // Formata telefone brasileiro
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function ClientsTable({
  clients,
  onEdit,
  onDelete,
  isLoading,
  onNewClient,
}: ClientsTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum cliente cadastrado"
        description="Cadastre seu primeiro cliente para começar a gerenciar os agendamentos."
        action={onNewClient ? { label: 'Novo Cliente', onClick: onNewClient } : undefined}
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
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Contato
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Agendamentos
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Cadastro
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-[var(--hover-bg)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-500">
                      <span className="text-sm font-medium">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{client.name}</p>
                      {client.notes && (
                        <p className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                          {client.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                      <Phone className="h-3.5 w-3.5" />
                      {formatPhone(client.phone)}
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[180px]">{client.email}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {client._count?.appointments || 0}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {client.hasDebts && (
                      <span className="inline-flex w-fit rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-500">
                        Com dívida
                      </span>
                    )}
                    {!client.isActive && (
                      <span className="inline-flex w-fit rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs font-medium text-zinc-400">
                        Inativo
                      </span>
                    )}
                    {client.isActive && !client.hasDebts && (
                      <span className="inline-flex w-fit rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-500">
                        Ativo
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-muted)]">
                  {formatDate(client.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                      disabled={isLoading}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuId === client.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-1 shadow-lg">
                          <button
                            onClick={() => {
                              onEdit(client);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onDelete(client);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10"
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
