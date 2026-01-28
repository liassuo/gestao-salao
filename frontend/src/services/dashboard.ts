import { api } from './api';
import type {
  DashboardStats,
  TodayAppointment,
  UpcomingAppointment,
  RecentActivity,
  RevenueByMethod,
  ProfessionalPerformance,
  DailyRevenue,
  ServicePopularity,
} from '../types/dashboard';

export type {
  DashboardStats,
  TodayAppointment,
  UpcomingAppointment,
  RecentActivity,
  RevenueByMethod,
  ProfessionalPerformance,
  DailyRevenue,
  ServicePopularity,
};

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getTodayAppointments: async (): Promise<TodayAppointment[]> => {
    const response = await api.get('/dashboard/today-appointments');
    return response.data;
  },

  getUpcomingAppointments: async (limit = 10): Promise<UpcomingAppointment[]> => {
    const response = await api.get(`/dashboard/upcoming-appointments?limit=${limit}`);
    return response.data;
  },

  getRecentActivity: async (limit = 10): Promise<RecentActivity[]> => {
    const response = await api.get(`/dashboard/recent-activity?limit=${limit}`);
    return response.data;
  },

  getRevenueByMethod: async (startDate?: string, endDate?: string): Promise<RevenueByMethod[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/dashboard/revenue-by-method?${params}`);
    return response.data;
  },

  getProfessionalPerformance: async (startDate?: string, endDate?: string): Promise<ProfessionalPerformance[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/dashboard/professional-performance?${params}`);
    return response.data;
  },

  getDailyRevenue: async (days = 30): Promise<DailyRevenue[]> => {
    const response = await api.get(`/dashboard/daily-revenue?days=${days}`);
    return response.data;
  },

  getServicesPopularity: async (limit = 10): Promise<ServicePopularity[]> => {
    const response = await api.get(`/dashboard/services-popularity?limit=${limit}`);
    return response.data;
  },
};
