import { Calendar, Users, DollarSign, AlertCircle, TrendingUp, Clock, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { formatCurrency, formatDateTime, formatTime } from '@/utils/format';
import { TopClientsCard } from './TopClientsCard';
import { LowStockCard } from './LowStockCard';
import { UnpaidClientsCard } from './UnpaidClientsCard';
import type { DashboardStats, UpcomingAppointment, RecentActivity, OperationalData } from '@/types/dashboard';

interface OperationalDashboardProps {
  stats: DashboardStats | null;
  statsLoading: boolean;
  appointments: UpcomingAppointment[];
  appointmentsLoading: boolean;
  activity: RecentActivity[];
  activityLoading: boolean;
  operationalData: OperationalData | null;
  operationalLoading: boolean;
}

export function OperationalDashboard({
  stats,
  statsLoading,
  appointments,
  appointmentsLoading,
  activity,
  activityLoading,
  operationalData,
  operationalLoading,
}: OperationalDashboardProps) {
  const statCards = [
    {
      label: 'Agendamentos Hoje',
      value: stats?.todayAppointments ?? '-',
      subValue: stats?.pendingAppointments ? `${stats.pendingAppointments} pendentes` : null,
      icon: Calendar,
      color: 'from-[#8B6914] to-[#C8923A]',
      shadowColor: 'shadow-[#C8923A]/20',
    },
    {
      label: 'Receita do Dia',
      value: stats ? formatCurrency(stats.todayRevenue) : '-',
      subValue: stats ? `Mês: ${formatCurrency(stats.monthRevenue)}` : null,
      icon: DollarSign,
      color: 'from-green-600 to-green-500',
      shadowColor: 'shadow-green-500/20',
    },
    {
      label: 'Clientes Ativos',
      value: stats?.activeClients ?? '-',
      subValue: stats ? `Total: ${stats.totalClients}` : null,
      icon: Users,
      color: 'from-[#8B6914] to-[#C8923A]',
      shadowColor: 'shadow-[#C8923A]/20',
    },
    {
      label: 'Dívidas Pendentes',
      value: stats ? formatCurrency(stats.totalDebts) : '-',
      subValue: stats?.clientsWithDebts ? `${stats.clientsWithDebts} clientes` : null,
      icon: AlertCircle,
      color: stats && stats.totalDebts > 0 ? 'from-[#8B2020] to-[#A63030]' : 'from-[#5C4530] to-[#6B5540]',
      shadowColor: stats && stats.totalDebts > 0 ? 'shadow-[#8B2020]/20' : 'shadow-zinc-500/20',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <DollarSign className="h-4 w-4" />;
      case 'appointment':
        return <Calendar className="h-4 w-4" />;
      case 'debt':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'payment':
        return 'bg-[#C8923A]/20 text-[#C8923A]';
      case 'appointment':
        return 'bg-[#C8923A]/20 text-[#C8923A]';
      case 'debt':
        return 'bg-red-500/20 text-[#A63030]';
      default:
        return 'bg-zinc-500/20 text-[var(--text-muted)]';
    }
  };

  const getPaymentMethodIcon = (method?: string) => {
    switch (method) {
      case 'CASH':
        return <Banknote className="h-3 w-3" />;
      case 'PIX':
        return <Smartphone className="h-3 w-3" />;
      case 'CARD':
        return <CreditCard className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} shadow-lg ${stat.shadowColor}`}
              >
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">{stat.label}</p>
                {statsLoading ? (
                  <div className="mt-1">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                    {stat.subValue && (
                      <p className="text-xs text-[var(--text-muted)]">{stat.subValue}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Change Indicator */}
      {stats && stats.revenueChange !== 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 backdrop-blur-sm transition-colors duration-200">
          <TrendingUp className={`h-5 w-5 ${stats.revenueChange >= 0 ? 'text-[#C8923A]' : 'text-[#A63030] rotate-180'}`} />
          <span className={`font-medium ${stats.revenueChange >= 0 ? 'text-[#C8923A]' : 'text-[#A63030]'}`}>
            {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange}%
          </span>
          <span className="text-[var(--text-muted)]">comparado ao mês anterior</span>
        </div>
      )}

      {/* Upcoming Appointments + Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Upcoming Appointments */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Próximos Agendamentos
          </h3>
          {appointmentsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : appointments.length === 0 ? (
            <p className="text-[var(--text-muted)]">Nenhum agendamento futuro.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3 transition-colors hover:bg-[var(--hover-bg)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20 text-[#C8923A]">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {appointment.client?.name || 'Cliente'}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {(appointment.services || []).map((s: any) => s.service?.name || s.name).join(', ') || 'Serviço'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[var(--text-primary)]">
                      {formatTime(appointment.scheduledAt)}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {appointment.professional?.name || 'Profissional'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Atividade Recente
          </h3>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : activity.length === 0 ? (
            <p className="text-[var(--text-muted)]">Nenhuma atividade recente.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-3"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${getActivityColor(item.type)}`}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDateTime(item.date)}
                    </p>
                  </div>
                  {item.amount && (
                    <div className="flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)]">
                      {item.method && getPaymentMethodIcon(item.method)}
                      {formatCurrency(item.amount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operational Data Cards */}
      {operationalLoading ? (
        <div className="mt-8 flex justify-center py-8">
          <Spinner />
        </div>
      ) : operationalData && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <TopClientsCard clients={operationalData.topClients} />
          <LowStockCard products={operationalData.lowStockProducts} />
          <UnpaidClientsCard clients={operationalData.unpaidClients} />
        </div>
      )}
    </div>
  );
}
