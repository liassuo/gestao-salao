import { api } from './api';
import type {
  Payment,
  PaymentFilters,
  PaymentTotals,
  CreatePaymentPayload,
  UpdatePaymentPayload,
} from '@/types';

export const paymentsService = {
  async list(filters?: PaymentFilters): Promise<Payment[]> {
    const params = new URLSearchParams();

    if (filters?.clientId) params.append('clientId', filters.clientId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.method) params.append('method', filters.method);

    const response = await api.get<Payment[]>('/payments', { params });
    return response.data;
  },

  async getTotals(filters?: Pick<PaymentFilters, 'startDate' | 'endDate'>): Promise<PaymentTotals> {
    const params = new URLSearchParams();

    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get<PaymentTotals>('/payments/totals', { params });
    return response.data;
  },

  async create(payload: CreatePaymentPayload): Promise<Payment> {
    const response = await api.post<Payment>('/payments', payload);
    return response.data;
  },

  async update(id: string, payload: UpdatePaymentPayload): Promise<Payment> {
    const response = await api.patch<Payment>(`/payments/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/payments/${id}`);
  },
};
