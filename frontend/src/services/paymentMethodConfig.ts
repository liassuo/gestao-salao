import { api } from './api';
import type { PaymentMethodConfig, PaymentMethodConfigFilters, CreatePaymentMethodConfigPayload, UpdatePaymentMethodConfigPayload } from '@/types';

export const paymentMethodConfigService = {
  async list(filters?: PaymentMethodConfigFilters): Promise<PaymentMethodConfig[]> {
    const params = new URLSearchParams();
    if (filters?.scope) params.append('scope', filters.scope);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const response = await api.get<PaymentMethodConfig[]>('/payment-method-config', { params });
    return response.data;
  },

  async getById(id: string): Promise<PaymentMethodConfig> {
    const response = await api.get<PaymentMethodConfig>(`/payment-method-config/${id}`);
    return response.data;
  },

  async create(payload: CreatePaymentMethodConfigPayload): Promise<PaymentMethodConfig> {
    const response = await api.post<PaymentMethodConfig>('/payment-method-config', payload);
    return response.data;
  },

  async update(id: string, payload: UpdatePaymentMethodConfigPayload): Promise<PaymentMethodConfig> {
    const response = await api.patch<PaymentMethodConfig>(`/payment-method-config/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/payment-method-config/${id}`);
  },
};
