import type { Client } from './client';
import type { Professional } from './professional';

export type AppointmentStatus = 'SCHEDULED' | 'ATTENDED' | 'CANCELED' | 'NO_SHOW';

export interface AppointmentService {
  id: string;
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  status: AppointmentStatus;
  isPaid: boolean;
  totalPrice: number;
  totalDuration: number;
  notes?: string;
  client: Pick<Client, 'id' | 'name' | 'phone' | 'email'>;
  professional: Pick<Professional, 'id' | 'name'>;
  services: AppointmentService[];
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentFilters {
  professionalId?: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  status?: AppointmentStatus;
}

export interface CreateAppointmentPayload {
  clientId: string;
  professionalId: string;
  serviceIds: string[];
  scheduledAt: string;
  notes?: string;
}

// Labels para exibição
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  ATTENDED: 'Atendido',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

export const appointmentStatusColors: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  ATTENDED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-gray-100 text-gray-800',
  NO_SHOW: 'bg-red-100 text-red-800',
};
