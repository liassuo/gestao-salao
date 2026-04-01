import { api } from './api';
import type { Commission, CommissionFilters, GenerateCommissionPayload } from '@/types';

export const commissionsService = {
  async list(filters?: CommissionFilters): Promise<Commission[]> {
    const params = new URLSearchParams();
    if (filters?.professionalId) params.append('professionalId', filters.professionalId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId);

    const response = await api.get<Commission[]>('/commissions', { params });
    return response.data;
  },

  async getById(id: string): Promise<Commission> {
    const response = await api.get<Commission>(`/commissions/${id}`);
    return response.data;
  },

  async generate(payload: GenerateCommissionPayload): Promise<Commission[]> {
    const response = await api.post<Commission[]>('/commissions/generate', payload);
    return response.data;
  },

  async markAsPaid(id: string): Promise<Commission> {
    const response = await api.patch<Commission>(`/commissions/${id}/pay`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/commissions/${id}`);
  },

  async getPoteReport(periodStart: string, periodEnd: string) {
    const response = await api.get('/commissions/pote-report', {
      params: { periodStart, periodEnd },
    });
    return response.data;
  },
};
