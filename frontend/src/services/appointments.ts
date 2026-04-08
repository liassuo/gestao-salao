import { api } from './api';
import type { Appointment, AppointmentFilters, CreateAppointmentPayload, CalendarProfessional, CalendarTimeBlock, CreateTimeBlockPayload } from '@/types';

export const appointmentsService = {
  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const response = await api.post<Appointment>('/appointments', payload);
    return response.data;
  },

  async list(filters?: AppointmentFilters): Promise<Appointment[]> {
    const params = new URLSearchParams();

    if (filters?.professionalId) params.append('professionalId', filters.professionalId);
    if (filters?.clientId) params.append('clientId', filters.clientId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await api.get<Appointment[]>('/appointments', { params });
    return response.data;
  },

  async listUnpaid(): Promise<Appointment[]> {
    const response = await api.get<Appointment[]>('/appointments/unpaid');
    return response.data;
  },

  async cancel(id: string): Promise<Appointment> {
    const response = await api.patch<Appointment>(`/appointments/${id}/cancel`);
    return response.data;
  },

  async attend(id: string, paymentMethod?: string): Promise<Appointment> {
    const response = await api.patch<Appointment>(`/appointments/${id}/attend`, {
      paymentMethod,
    });
    return response.data;
  },

  async noShow(id: string): Promise<Appointment> {
    const response = await api.patch<Appointment>(`/appointments/${id}/no-show`);
    return response.data;
  },

  async getCalendar(date: string): Promise<CalendarProfessional[]> {
    const response = await api.get<CalendarProfessional[]>('/appointments/calendar', { params: { date } });
    return response.data;
  },

  async createTimeBlock(payload: CreateTimeBlockPayload): Promise<CalendarTimeBlock> {
    const response = await api.post<CalendarTimeBlock>('/appointments/block', payload);
    return response.data;
  },

  async deleteTimeBlock(id: string): Promise<void> {
    await api.delete(`/appointments/block/${id}`);
  },

  async update(id: string, data: { scheduledAt?: string; notes?: string; professionalId?: string }): Promise<Appointment> {
    const response = await api.patch<Appointment>(`/appointments/${id}`, data);
    return response.data;
  },
};
