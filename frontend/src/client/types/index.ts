// Status do backend: SCHEDULED, ATTENDED, CANCELED, NO_SHOW
export type AppointmentStatus = 'SCHEDULED' | 'ATTENDED' | 'CANCELED' | 'NO_SHOW';

export interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number; // Em centavos
}

export interface Professional {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatarUrl?: string | null;
  serviceIds?: string[];
  services?: { id: string; name: string }[];
}

export interface AppointmentService {
  id: string;
  service: Service;
}

export interface Appointment {
  id: string;
  scheduledAt: string; // ISO DateTime
  status: AppointmentStatus;
  totalPrice: number; // Em centavos
  totalDuration: number; // Em minutos
  isPaid: boolean;
  notes?: string;
  services: AppointmentService[];
  professional: Professional;
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface CreateAppointmentData {
  serviceIds: string[];
  professionalId: string;
  date: string;
  startTime: string;
}

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface ClientLoginResponse {
  accessToken: string;
  user: ClientUser;
}
