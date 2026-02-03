import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { MonthlyRevenue } from '@/types/dashboard';

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

// Format month string "2026-01" to "Jan/26"
function formatMonth(month: string) {
  const [year, m] = month.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]}/${year.slice(2)}`;
}

// Format currency for tooltip
function formatValue(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data.map((d) => ({ ...d, label: formatMonth(d.month) }));

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Faturamento Mensal</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
              formatter={(value: number | undefined) => [formatValue(value ?? 0), 'Faturamento']}
              labelFormatter={(label) => label}
            />
            <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
