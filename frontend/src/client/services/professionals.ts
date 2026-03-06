import { clientApi } from './api';
import type { Professional } from '../types';

export const professionalsApi = {
  getAll: async (): Promise<Professional[]> => {
    const response = await clientApi.get<Professional[]>('/professionals');
    return response.data;
  },

  getById: async (id: string): Promise<Professional> => {
    const response = await clientApi.get<Professional>(`/professionals/${id}`);
    return response.data;
  },

  getByService: async (serviceId: string): Promise<Professional[]> => {
    const response = await clientApi.get<Professional[]>('/professionals', {
      params: { serviceId },
    });
    return response.data;
  },

  getAvailableForBooking: async (serviceIds: string[], date: string): Promise<Professional[]> => {
    const response = await clientApi.get<Professional[]>('/professionals/available-for-booking', {
      params: { serviceIds: serviceIds.join(','), date },
    });
    return response.data;
  },
};
