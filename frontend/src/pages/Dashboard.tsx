import { Calendar, Users, DollarSign, TrendingUp, AlertCircle, Clock, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { useDashboardStats, useUpcomingAppointments, useRecentActivity } from '../hooks/useDashboard';
import { formatCurrency, formatDateTime, formatTime } from '../utils/format';
import { Spinner } from '../components/ui';

export function Dashboard() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { appointments, loading: appointmentsLoading } = useUpcomingAppointments(5);
  const { activity, loading: activityLoading } = useRecentActivity(8);

  const statCards = [
    {
      label: 'Agendamentos Hoje',
      value: stats?.todayAppointments ?? '-',
      subValue: stats?.pendingAppointments ? `${stats.pendingAppointments} pendentes` : null,
      icon: Calendar,
      color: 'from-blue-600 to-blue-500',
      shadowColor: 'shadow-blue-500/20',
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
      color: 'from-blue-600 to-blue-500',
      shadowColor: 'shadow-blue-500/20',
    },
    {
      label: 'Dívidas Pendentes',
      value: stats ? formatCurrency(stats.totalDebts) : '-',
      subValue: stats?.clientsWithDebts ? `${stats.clientsWithDebts} clientes` : null,
      icon: AlertCircle,
      color: stats && stats.totalDebts > 0 ? 'from-red-600 to-red-500' : 'from-zinc-600 to-zinc-500',
      shadowColor: stats && stats.totalDebts > 0 ? 'shadow-red-500/20' : 'shadow-zinc-500/20',
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
        return 'bg-blue-500/20 text-blue-500';
      case 'appointment':
        return 'bg-blue-500/20 text-blue-500';
      case 'debt':
        return 'bg-red-500/20 text-red-500';
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
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>

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
          <TrendingUp className={`h-5 w-5 ${stats.revenueChange >= 0 ? 'text-blue-500' : 'text-red-500 rotate-180'}`} />
          <span className={`font-medium ${stats.revenueChange >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
            {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange}%
          </span>
          <span className="text-[var(--text-muted)]">comparado ao mês anterior</span>
        </div>
      )}

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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-500">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {appointment.client.name}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {appointment.services.map((s) => s.service.name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[var(--text-primary)]">
                      {formatTime(appointment.scheduledAt)}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {appointment.professional.name}
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

      {/* Quick Stats Summary */}
      {stats && (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 backdrop-blur-sm transition-colors duration-200">
            <p className="text-sm text-[var(--text-muted)]">Profissionais Ativos</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{stats.totalProfessionals}</p>
          </div>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 backdrop-blur-sm transition-colors duration-200">
            <p className="text-sm text-[var(--text-muted)]">Agendamentos Pendentes</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{stats.pendingAppointments}</p>
          </div>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 backdrop-blur-sm transition-colors duration-200">
            <p className="text-sm text-[var(--text-muted)]">Clientes com Dívidas</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{stats.clientsWithDebts}</p>
          </div>
        </div>
      )}
    </div>
  );
}
