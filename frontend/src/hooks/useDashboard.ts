import { useState, useEffect } from 'react';
import { dashboardService } from '../services/dashboard';
import type { DashboardStats, TodayAppointment, UpcomingAppointment, RecentActivity, OperationalData, StrategicData, DailyRevenue } from '../types/dashboard';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar estatísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refetch: fetchStats };
}

export function useTodayAppointments() {
  const [appointments, setAppointments] = useState<TodayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getTodayAppointments();
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar agendamentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  return { appointments, loading, error, refetch: fetchAppointments };
}

export function useUpcomingAppointments(limit = 5) {
  const [appointments, setAppointments] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getUpcomingAppointments(limit);
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar agendamentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [limit]);

  return { appointments, loading, error, refetch: fetchAppointments };
}

export function useRecentActivity(limit = 10) {
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getRecentActivity(limit);
      setActivity(data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar atividades');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [limit]);

  return { activity, loading, error, refetch: fetchActivity };
}

export function useOperationalData() {
  const [data, setData] = useState<OperationalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await dashboardService.getOperationalData();
      setData(result);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados operacionais');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useStrategicData() {
  const [data, setData] = useState<StrategicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await dashboardService.getStrategicData();
      setData(result);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados estratégicos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

export function useDailyRevenueData(days = 30) {
  const [data, setData] = useState<DailyRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getDailyRevenue(days).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  return { data, loading };
}
