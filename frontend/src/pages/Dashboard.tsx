import { useState } from 'react';
import { useDashboardStats, useUpcomingAppointments, useRecentActivity, useOperationalData, useStrategicData } from '../hooks/useDashboard';
import { DashboardTabs, OperationalDashboard, StrategicDashboard } from '../components/dashboard';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'operational' | 'strategic'>('operational');

  const { stats, loading: statsLoading } = useDashboardStats();
  const { appointments, loading: appointmentsLoading } = useUpcomingAppointments(5);
  const { activity, loading: activityLoading } = useRecentActivity(8);
  const { data: operationalData, loading: operationalLoading } = useOperationalData();
  const { data: strategicData, loading: strategicLoading } = useStrategicData();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 'operational' ? (
        <OperationalDashboard
          stats={stats}
          statsLoading={statsLoading}
          appointments={appointments}
          appointmentsLoading={appointmentsLoading}
          activity={activity}
          activityLoading={activityLoading}
          operationalData={operationalData}
          operationalLoading={operationalLoading}
        />
      ) : (
        <StrategicDashboard
          data={strategicData}
          loading={strategicLoading}
        />
      )}
    </div>
  );
}
