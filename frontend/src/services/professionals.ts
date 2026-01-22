import { api } from './api';
import type { Professional, CreateProfessionalPayload, UpdateProfessionalPayload } from '@/types';

export const professionalsService = {
  async list(serviceId?: string): Promise<Professional[]> {
    const params = serviceId ? { serviceId } : undefined;
    const response = await api.get<Professional[]>('/professionals', { params });
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
};
