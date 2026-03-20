import { AlertTriangle } from 'lucide-react';
import { formatCurrency, formatPhone } from '@/utils/format';
import type { UnpaidClient } from '@/types/dashboard';

interface UnpaidClientsCardProps {
  clients: UnpaidClient[];
}

export function UnpaidClientsCard({ clients }: UnpaidClientsCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B2020] to-[#A63030] shadow-lg shadow-[#8B2020]/20">
          <AlertTriangle className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Clientes Inadimplentes</h3>
      </div>

      {clients.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum cliente inadimplente.</p>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{client.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{formatPhone(client.phone)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-[#C45050]">
                  {formatCurrency(client.unpaidAmount)}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {client.unpaidCount} {client.unpaidCount === 1 ? 'pendência' : 'pendências'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
