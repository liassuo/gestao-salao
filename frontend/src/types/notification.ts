export type NotificationType =
  | 'appointment_created'
  | 'appointment_canceled'
  | 'appointment_reminder'
  | 'payment_received'
  | 'payment_pending'
  | 'debt_created'
  | 'debt_paid'
  | 'client_registered'
  | 'subscription_created'
  | 'subscription_expired'
  | 'system_announcement';

export type NotificationPriority = 'low' | 'medium' | 'high';
export type DisplayCategory = 'success' | 'info' | 'warning' | 'alert';

export interface Notification {
  id: string;
  type: NotificationType;
  displayCategory: DisplayCategory;
  title: string;
  message: string;
  priority: NotificationPriority;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  archived: boolean;
  created_at: string;
  read_at?: string;
  metadata?: Record<string, any>;
  actor?: {
    id: string;
    name: string;
  } | null;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
}

// Mapeamento de tipo → displayCategory
export const NOTIFICATION_DISPLAY_MAP: Record<NotificationType, DisplayCategory> = {
  appointment_created: 'info',
  appointment_canceled: 'warning',
  appointment_reminder: 'info',
  payment_received: 'success',
  payment_pending: 'warning',
  debt_created: 'alert',
  debt_paid: 'success',
  client_registered: 'info',
  subscription_created: 'success',
  subscription_expired: 'warning',
  system_announcement: 'info',
};

// Labels em português para cada tipo
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  appointment_created: 'Agendamento criado',
  appointment_canceled: 'Agendamento cancelado',
  appointment_reminder: 'Lembrete',
  payment_received: 'Pagamento recebido',
  payment_pending: 'Pagamento pendente',
  debt_created: 'Dívida registrada',
  debt_paid: 'Dívida quitada',
  client_registered: 'Novo cliente',
  subscription_created: 'Assinatura criada',
  subscription_expired: 'Assinatura expirada',
  system_announcement: 'Aviso do sistema',
};
