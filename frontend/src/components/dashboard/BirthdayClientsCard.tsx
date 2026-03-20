import { Cake } from 'lucide-react';
import { formatPhone } from '@/utils/format';
import type { BirthdayClient } from '@/types/dashboard';

interface BirthdayClientsCardProps {
  clients: BirthdayClient[];
}

function formatBirthday(birthDate: string): string {
  const day = birthDate.substring(8, 10);
  const month = birthDate.substring(5, 7);
  return `${day}/${month}`;
}

export function BirthdayClientsCard({ clients = [] }: BirthdayClientsCardProps) {
  const today = new Date().getDate();
  const upcoming = clients.filter((c) => c.day >= today);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-600 to-pink-500 shadow-lg shadow-pink-500/20">
          <Cake className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Aniversariantes do Mês</h3>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum aniversariante nos proximos dias.</p>
      ) : (
        <div className="space-y-3">
          {upcoming.map((client) => {
            const isToday = client.day === today;

            return (
              <div
                key={client.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  isToday
                    ? 'border-pink-500/30 bg-pink-500/10'
                    : 'border-[var(--border-color)] bg-[var(--hover-bg)]'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {client.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{formatPhone(client.phone)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isToday && (
                    <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-xs font-medium text-pink-400">
                      Hoje!
                    </span>
                  )}
                  <span className={`text-sm font-semibold ${isToday ? 'text-pink-400' : 'text-[var(--text-muted)]'}`}>
                    {formatBirthday(client.birthDate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
