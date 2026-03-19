import { Crown } from 'lucide-react';
import type { TopClient } from '@/types/dashboard';

interface TopClientsCardProps {
  clients: TopClient[];
}

export function TopClientsCard({ clients }: TopClientsCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-600 to-yellow-500 shadow-lg shadow-yellow-500/20">
          <Crown className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Top Clientes</h3>
      </div>

      {clients.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum dado disponível.</p>
      ) : (
        <div className="space-y-2">
          {clients.map((client, index) => (
            <div
              key={client.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8923A]/20 text-xs font-bold text-[#C8923A]">
                {index + 1}
              </span>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{client.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
