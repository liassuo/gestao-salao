import { clientApi } from './api';
import type { Service } from '../types';

export const servicesApi = {
  getAll: async (): Promise<Service[]> => {
    const response = await clientApi.get<Service[]>('/services');
    return response.data;
  },

  getById: async (id: string): Promise<Service> => {
    const response = await clientApi.get<Service>(`/services/${id}`);
    return response.data;
  },
};
