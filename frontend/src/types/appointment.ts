import type { Client } from './client';
import type { Professional } from './professional';

export type AppointmentStatus = 'SCHEDULED' | 'ATTENDED' | 'CANCELED' | 'NO_SHOW' | 'PENDING_PAYMENT';

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
  usedSubscriptionCut?: boolean;
  rating?: number;
  ratingComment?: string;
  client: Pick<Client, 'id' | 'name' | 'phone' | 'email'> | null;
  clientName?: string;
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
  clientId?: string;
  clientName?: string;
  professionalId: string;
  serviceIds: string[];
  scheduledAt: string;
  notes?: string;
  /** Cobrança digital Asaas quando o valor total > 0 */
  billingType?: 'PIX' | 'CREDIT_CARD';
}

// Labels para exibição
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  ATTENDED: 'Atendido',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
  PENDING_PAYMENT: 'Aguardando Pagamento',
};

export const appointmentStatusColors: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-500/20 text-blue-500',
  ATTENDED: 'bg-blue-600/20 text-blue-400',
  CANCELED: 'bg-zinc-500/20 text-zinc-400',
  NO_SHOW: 'bg-red-500/20 text-red-500',
  PENDING_PAYMENT: 'bg-amber-500/20 text-amber-500',
};
