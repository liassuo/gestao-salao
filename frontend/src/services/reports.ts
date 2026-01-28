import { api } from './api';
import type {
  SalesReport,
  ProfessionalReport,
  ServicesReport,
  ClientsReport,
  DebtsReport,
  CashRegisterReport,
} from '../types/reports';

export type {
  SalesReport,
  ProfessionalReport,
  ServicesReport,
  ClientsReport,
  DebtsReport,
  CashRegisterReport,
};

const buildParams = (startDate?: string, endDate?: string, professionalId?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (professionalId) params.append('professionalId', professionalId);
  return params.toString();
};

export const reportsService = {
  getSalesReport: async (startDate?: string, endDate?: string, professionalId?: string): Promise<SalesReport> => {
    const params = buildParams(startDate, endDate, professionalId);
    const response = await api.get(`/reports/sales?${params}`);
    return response.data;
  },

  getProfessionalsReport: async (startDate?: string, endDate?: string, professionalId?: string): Promise<ProfessionalReport[]> => {
    const params = buildParams(startDate, endDate, professionalId);
    const response = await api.get(`/reports/professionals?${params}`);
    return response.data;
  },

  getServicesReport: async (startDate?: string, endDate?: string): Promise<ServicesReport[]> => {
    const params = buildParams(startDate, endDate);
    const response = await api.get(`/reports/services?${params}`);
    return response.data;
  },

  getClientsReport: async (startDate?: string, endDate?: string): Promise<ClientsReport> => {
    const params = buildParams(startDate, endDate);
    const response = await api.get(`/reports/clients?${params}`);
    return response.data;
  },

  getDebtsReport: async (startDate?: string, endDate?: string): Promise<DebtsReport> => {
    const params = buildParams(startDate, endDate);
    const response = await api.get(`/reports/debts?${params}`);
    return response.data;
  },

  getCashRegisterReport: async (startDate?: string, endDate?: string): Promise<CashRegisterReport> => {
    const params = buildParams(startDate, endDate);
    const response = await api.get(`/reports/cash-register?${params}`);
    return response.data;
  },
};
