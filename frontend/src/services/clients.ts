import { api } from './api';
import type { Client, ClientFilters, CreateClientPayload, UpdateClientPayload } from '@/types';

export const clientsService = {
  async list(filters?: ClientFilters): Promise<Client[]> {
    const params: Record<string, string> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.hasDebts !== undefined) params.hasDebts = String(filters.hasDebts);
    if (filters?.isActive !== undefined) params.isActive = String(filters.isActive);

    const response = await api.get<Client[]>('/clients', { params });
    return response.data;
  },

  async getById(id: string): Promise<Client> {
    const response = await api.get<Client>(`/clients/${id}`);
    return response.data;
  },

  async create(payload: CreateClientPayload): Promise<Client> {
    const response = await api.post<Client>('/clients', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateClientPayload): Promise<Client> {
    const response = await api.patch<Client>(`/clients/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  async permanentDelete(id: string): Promise<void> {
    await api.delete(`/clients/${id}/permanent`);
  },
};
