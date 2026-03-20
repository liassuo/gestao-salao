import { api } from './api';
import type { Professional, CreateProfessionalPayload, UpdateProfessionalPayload } from '@/types';

export const professionalsService = {
  async list(serviceId?: string, isActive?: string): Promise<Professional[]> {
    const params: Record<string, string> = {};
    if (serviceId) params.serviceId = serviceId;
    if (isActive !== undefined) params.isActive = isActive;
    const response = await api.get<Professional[]>('/professionals', { params: Object.keys(params).length ? params : undefined });
    return response.data;
  },

  async getById(id: string): Promise<Professional> {
    const response = await api.get<Professional>(`/professionals/${id}`);
    return response.data;
  },

  async create(payload: CreateProfessionalPayload): Promise<Professional> {
    const response = await api.post<Professional>('/professionals', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateProfessionalPayload): Promise<Professional> {
    const response = await api.patch<Professional>(`/professionals/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/professionals/${id}`);
  },

  async permanentDelete(id: string): Promise<void> {
    await api.delete(`/professionals/${id}/permanent`);
  },

  async resetPassword(professionalId: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`/auth/reset-professional-password/${professionalId}`);
    return response.data;
  },
};
