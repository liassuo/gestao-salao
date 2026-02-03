import { UserCheck } from 'lucide-react';
import type { ProfessionalOccupancy } from '@/types/dashboard';

interface OccupancyCardProps {
  professionals: ProfessionalOccupancy[];
}

function getBarColor(rate: number) {
  if (rate >= 70) return 'bg-blue-500';
  if (rate >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getTextColor(rate: number) {
  if (rate >= 70) return 'text-blue-400';
  if (rate >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

export function OccupancyCard({ professionals }: OccupancyCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20">
          <UserCheck className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Ocupação dos Profissionais</h3>
      </div>

      {professionals.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum dado disponível.</p>
      ) : (
        <div className="space-y-4">
          {professionals.map((prof) => (
            <div key={prof.id}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{prof.name}</span>
                <span className={`text-sm font-bold ${getTextColor(prof.occupancyRate)}`}>
                  {prof.occupancyRate.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--hover-bg)]">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getBarColor(prof.occupancyRate)}`}
                  style={{ width: `${Math.min(prof.occupancyRate, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {prof.attendedAppointments} de {prof.totalAppointments} atendimentos
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
