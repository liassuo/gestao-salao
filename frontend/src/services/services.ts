import { api } from './api';
import type { Service, CreateServicePayload, UpdateServicePayload } from '@/types';

// Transforma resposta do backend para frontend (duration -> durationMinutes)
function transformService(data: any): Service {
  return {
    ...data,
    durationMinutes: data.duration, // alias para compatibilidade
  };
}

export const servicesService = {
  async list(): Promise<Service[]> {
    const response = await api.get<Service[]>('/services');
    return response.data.map(transformService);
  },

  async getById(id: string): Promise<Service> {
    const response = await api.get<Service>(`/services/${id}`);
    return transformService(response.data);
  },

  async create(payload: CreateServicePayload): Promise<Service> {
    const response = await api.post<Service>('/services', payload);
    return transformService(response.data);
  },

  async update(id: string, payload: UpdateServicePayload): Promise<Service> {
    const response = await api.patch<Service>(`/services/${id}`, payload);
    return transformService(response.data);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  },
};
