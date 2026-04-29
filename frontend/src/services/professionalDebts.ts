import { api } from './api';
import type {
  ProfessionalDebt,
  ProfessionalDebtFilters,
  ProfessionalDebtSummary,
  CreateProfessionalDebtPayload,
  SettleProfessionalDebtCashPayload,
} from '@/types';

export const professionalDebtsService = {
  async list(filters?: ProfessionalDebtFilters): Promise<ProfessionalDebt[]> {
    const params = new URLSearchParams();
    if (filters?.professionalId) params.append('professionalId', filters.professionalId);
    if (filters?.status) params.append('status', filters.status);
    const response = await api.get<ProfessionalDebt[]>('/professional-debts', { params });
    return response.data;
  },

  async getPendingByProfessional(professionalId: string): Promise<ProfessionalDebt[]> {
    const response = await api.get<ProfessionalDebt[]>(
      `/professional-debts/professional/${professionalId}/pending`,
    );
    return response.data;
  },

  async getSummary(professionalId: string): Promise<ProfessionalDebtSummary> {
    const response = await api.get<ProfessionalDebtSummary>(
      `/professional-debts/professional/${professionalId}/summary`,
    );
    return response.data;
  },

  async create(payload: CreateProfessionalDebtPayload): Promise<ProfessionalDebt> {
    const response = await api.post<ProfessionalDebt>('/professional-debts', payload);
    return response.data;
  },

  async settleCash(
    id: string,
    payload: SettleProfessionalDebtCashPayload,
  ): Promise<ProfessionalDebt> {
    const response = await api.patch<ProfessionalDebt>(
      `/professional-debts/${id}/settle-cash`,
      payload,
    );
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/professional-debts/${id}`);
  },
};
