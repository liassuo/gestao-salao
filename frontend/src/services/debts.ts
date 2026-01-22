import { api } from './api';
import type { Debt, DebtFilters, CreateDebtPayload, PartialPaymentPayload } from '@/types';

export interface DebtOutstandingStats {
  totalDebts: number;
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface ClientDebtTotal {
  clientId: string;
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
}

export const debtsService = {
  async list(filters?: DebtFilters): Promise<Debt[]> {
    const params = new URLSearchParams();

    if (filters?.clientId) params.append('clientId', filters.clientId);
    if (filters?.isSettled !== undefined) {
      params.append('isSettled', String(filters.isSettled));
    }

    const response = await api.get<Debt[]>('/debts', { params });
    return response.data;
  },

  async getOutstanding(): Promise<Debt[]> {
    const response = await api.get<Debt[]>('/debts/outstanding');
    return response.data;
  },

  async getClientTotal(clientId: string): Promise<ClientDebtTotal> {
    const response = await api.get<ClientDebtTotal>(`/debts/client/${clientId}/total`);
    return response.data;
  },

  async create(payload: CreateDebtPayload): Promise<Debt> {
    const response = await api.post<Debt>('/debts', payload);
    return response.data;
  },

  async partialPayment(id: string, payload: PartialPaymentPayload): Promise<Debt> {
    const response = await api.post<Debt>(`/debts/${id}/partial-payment`, payload);
    return response.data;
  },

  async settle(id: string): Promise<Debt> {
    const response = await api.patch<Debt>(`/debts/${id}/settle`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/debts/${id}`);
  },
};
