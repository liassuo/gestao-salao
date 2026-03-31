// Tipos de notificação do sistema (barbearia/salão)
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
export type AntiSpamStrategy = 'always' | 'aggregate' | 'cooldown';
export type DisplayCategory = 'success' | 'info' | 'warning' | 'alert';

// Tipos de destinatário
export type RecipientTarget =
  | { type: 'user'; user_id: string }
  | { type: 'role'; role: 'ADMIN' | 'PROFESSIONAL' | 'CLIENT' }
  | { type: 'all' };

// Input para enviar notificação
export interface SendNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  targets: RecipientTarget[];
  actor_id?: string;
  priority?: NotificationPriority;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  group_key?: string;
  anti_spam?: AntiSpamStrategy;
  cooldown_minutes?: number;
  metadata?: Record<string, any>;
}

// Config padrão por tipo de notificação
export const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { defaultPriority: NotificationPriority; displayCategory: DisplayCategory }
> = {
  appointment_created: { defaultPriority: 'high', displayCategory: 'info' },
  appointment_canceled: { defaultPriority: 'high', displayCategory: 'warning' },
  appointment_reminder: { defaultPriority: 'medium', displayCategory: 'info' },
  payment_received: { defaultPriority: 'medium', displayCategory: 'success' },
  payment_pending: { defaultPriority: 'medium', displayCategory: 'warning' },
  debt_created: { defaultPriority: 'high', displayCategory: 'alert' },
  debt_paid: { defaultPriority: 'medium', displayCategory: 'success' },
  client_registered: { defaultPriority: 'low', displayCategory: 'info' },
  subscription_created: { defaultPriority: 'medium', displayCategory: 'success' },
  subscription_expired: { defaultPriority: 'high', displayCategory: 'warning' },
  system_announcement: { defaultPriority: 'medium', displayCategory: 'info' },
};
