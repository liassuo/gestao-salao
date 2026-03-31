import { api } from './api';
import type { Notification, NotificationsResponse } from '@/types/notification';
import { NOTIFICATION_DISPLAY_MAP } from '@/types/notification';

function mapNotification(raw: any): Notification {
  return {
    id: raw.id,
    type: raw.type,
    displayCategory: NOTIFICATION_DISPLAY_MAP[raw.type as keyof typeof NOTIFICATION_DISPLAY_MAP] || 'info',
    title: raw.title,
    message: raw.message,
    priority: raw.priority || 'medium',
    action_url: raw.action_url,
    entity_type: raw.entity_type,
    entity_id: raw.entity_id,
    read: raw.read,
    archived: raw.archived,
    created_at: raw.created_at,
    read_at: raw.read_at,
    metadata: raw.metadata,
    actor: raw.actor || null,
  };
}

export const inAppNotificationService = {
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    filter?: 'all' | 'unread' | 'read';
    type?: string;
  }): Promise<NotificationsResponse> {
    const { data } = await api.get<NotificationsResponse>(
      '/in-app-notifications',
      { params },
    );
    return {
      ...data,
      data: data.data.map(mapNotification),
    };
  },

  async getUnreadCount(): Promise<number> {
    const { data } = await api.get<{ count: number }>(
      '/in-app-notifications/unread-count',
    );
    return data.count;
  },

  async markAsRead(ids: string[]): Promise<void> {
    await api.patch('/in-app-notifications/read', { ids });
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/in-app-notifications/read-all');
  },

  async archive(ids: string[]): Promise<void> {
    await api.patch('/in-app-notifications/archive', { ids });
  },

  async deleteNotifications(ids: string[]): Promise<void> {
    await api.post('/in-app-notifications/delete', { ids });
  },
};
