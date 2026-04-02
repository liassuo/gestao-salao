import { api } from './api';
import type {
  Order, CreateOrderPayload, AddOrderItemPayload, OrderFilters,
} from '@/types';

export const ordersService = {
  async list(filters?: OrderFilters): Promise<Order[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.branchId) params.append('branchId', filters.branchId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.clientId) params.append('clientId', filters.clientId);
    const response = await api.get<Order[]>('/orders', { params });
    return response.data;
  },

  async getById(id: string): Promise<Order> {
    const response = await api.get<Order>(`/orders/${id}`);
    return response.data;
  },

  async getByAppointment(appointmentId: string): Promise<Order | null> {
    const response = await api.get<Order | null>(`/orders/by-appointment/${appointmentId}`);
    return response.data;
  },

  async create(payload: CreateOrderPayload): Promise<Order> {
    const response = await api.post<Order>('/orders', payload);
    return response.data;
  },

  async addItem(orderId: string, payload: AddOrderItemPayload): Promise<Order> {
    const response = await api.post<Order>(`/orders/${orderId}/items`, payload);
    return response.data;
  },

  async removeItem(orderId: string, itemId: string): Promise<void> {
    await api.delete(`/orders/${orderId}/items/${itemId}`);
  },

  async pay(id: string, data?: { paymentMethod?: string; billingType?: string; dueDate?: string }): Promise<Order & { asaasCharge?: unknown; pixQrCode?: unknown }> {
    const response = await api.patch<Order & { asaasCharge?: unknown; pixQrCode?: unknown }>(`/orders/${id}/pay`, data || {});
    return response.data;
  },

  async cancel(id: string): Promise<Order> {
    const response = await api.patch<Order>(`/orders/${id}/cancel`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/orders/${id}`);
  },
};
