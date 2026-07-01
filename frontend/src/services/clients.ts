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

  // Busca enxuta (id, name, phone) para o autocomplete do agendamento. Liberada
  // para o barbeiro (PROFESSIONAL), diferente de list() que é só ADMIN.
  async search(term: string): Promise<Pick<Client, 'id' | 'name' | 'phone'>[]> {
    const response = await api.get<Pick<Client, 'id' | 'name' | 'phone'>[]>('/clients/search', {
      params: { q: term },
    });
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

  async resetPassword(clientId: string): Promise<ResetClientPasswordResponse> {
    const response = await api.post<ResetClientPasswordResponse>(
      `/auth/reset-client-password/${clientId}`,
    );
    return response.data;
  },
};

export interface ResetClientPasswordResponse {
  message: string;
  tempPassword: string;
  clientName: string;
  clientPhone: string | null;
}
