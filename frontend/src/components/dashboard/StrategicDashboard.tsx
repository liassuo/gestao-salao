import { DollarSign, Calendar } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { formatCurrency } from '@/utils/format';
import { PlansStatsCard } from './PlansStatsCard';
import { RevenueChart } from './RevenueChart';
import { OccupancyCard } from './OccupancyCard';
import type { StrategicData } from '@/types/dashboard';

interface StrategicDashboardProps {
  data: StrategicData | null;
  loading: boolean;
}

export function StrategicDashboard({ data, loading }: StrategicDashboardProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-[var(--text-muted)]">Erro ao carregar dados estratégicos.</p>
    );
  }

  return (
    <div>
      {/* Row 1: Plans Stats + Revenue Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PlansStatsCard
          activePlans={data.plans.activePlans}
          soldThisMonth={data.plans.soldThisMonth}
          canceledThisMonth={data.plans.canceledThisMonth}
        />
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Resumo de Faturamento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-600 to-green-500 shadow-lg shadow-green-500/20">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Faturamento Mensal</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(data.revenue.monthlyRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Faturamento Anual</p>
                <p className="text-xl font-bold text-blue-400">{formatCurrency(data.revenue.yearlyRevenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Revenue Chart (full width) */}
      <div className="mt-8">
        <RevenueChart data={data.monthlyRevenueHistory} />
      </div>

      {/* Row 3: Occupancy Card */}
      <div className="mt-8">
        <OccupancyCard professionals={data.professionalOccupancy} />
      </div>
    </div>
  );
}
