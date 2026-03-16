import { clientApi } from './api';
import type { Appointment, CreateAppointmentData, TimeSlot } from '../types';

export const appointmentsApi = {
  getMyAppointments: async (): Promise<Appointment[]> => {
    const response = await clientApi.get<Appointment[]>('/appointments/me');
    return response.data;
  },

  getAvailableSlots: async (
    professionalId: string,
    date: string,
    duration?: number
  ): Promise<TimeSlot[]> => {
    const response = await clientApi.get<TimeSlot[]>('/appointments/available-slots', {
      params: { professionalId, date, duration },
    });
    return response.data;
  },

  create: async (data: CreateAppointmentData): Promise<Appointment> => {
    const response = await clientApi.post<Appointment>('/appointments/client', data);
    return response.data;
  },

  cancel: async (id: string): Promise<Appointment> => {
    const response = await clientApi.patch<Appointment>(`/appointments/${id}/cancel`);
    return response.data;
  },

  rate: async (id: string, rating: number, comment?: string): Promise<Appointment> => {
    const response = await clientApi.patch<Appointment>(`/appointments/${id}/rate`, { rating, comment });
    return response.data;
  },
};
