import { api } from './api';
import type {
  CashRegister,
  CashRegisterFilters,
  CashRegisterSummary,
  OpenCashRegisterPayload,
  CloseCashRegisterPayload,
} from '@/types';

export const cashRegisterService = {
  async list(filters?: CashRegisterFilters): Promise<CashRegister[]> {
    const params = new URLSearchParams();

    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get<CashRegister[]>('/cash-register', { params });
    return response.data;
  },

  async getToday(): Promise<CashRegister | null> {
    try {
      const response = await api.get<CashRegister>('/cash-register/today');
      return response.data;
    } catch (error: unknown) {
      // Se não houver caixa hoje, retorna null
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  },

  async getOpen(): Promise<CashRegister | null> {
    try {
      const response = await api.get<CashRegister>('/cash-register/open');
      return response.data;
    } catch (error: unknown) {
      // Se não houver caixa aberto, retorna null
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  },

  async getSummary(filters?: CashRegisterFilters): Promise<CashRegisterSummary> {
    const params = new URLSearchParams();

    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get<CashRegisterSummary>('/cash-register/summary', { params });
    return response.data;
  },

  async open(payload: OpenCashRegisterPayload): Promise<CashRegister> {
    const response = await api.post<CashRegister>('/cash-register/open', payload);
    return response.data;
  },

  async close(id: string, payload: CloseCashRegisterPayload): Promise<CashRegister> {
    const response = await api.patch<CashRegister>(`/cash-register/${id}/close`, payload);
    return response.data;
  },
};
