import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth';
import { useToast } from '@/components/ui';
import { inAppNotificationService } from '@/services/inAppNotifications';
import type { Notification, DisplayCategory } from '@/types/notification';
import { NOTIFICATION_DISPLAY_MAP } from '@/types/notification';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (page?: number) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotifications: (ids: string[]) => Promise<void>;
  deleteNotifications: (ids: string[]) => Promise<void>;
  totalPages: number;
  currentPage: number;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await inAppNotificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silently fail
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(
    async (page = 1) => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      try {
        const response = await inAppNotificationService.getNotifications({
          page,
          limit: 20,
        });
        setNotifications(response.data);
        setTotalPages(Math.ceil(response.total / response.limit) || 1);
        setCurrentPage(page);
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated],
  );

  // Fetch inicial
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    refreshUnreadCount();
    fetchNotifications();
  }, [isAuthenticated, user?.id, refreshUnreadCount, fetchNotifications]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return; // Supabase não configurado

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const raw = payload.new as any;
          const notification: Notification = {
            id: raw.id,
            type: raw.type,
            displayCategory:
              (NOTIFICATION_DISPLAY_MAP as any)[raw.type] || 'info',
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
            actor: null,
          };

          setNotifications((prev) => [notification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Toast baseado na categoria
          const category = notification.displayCategory as DisplayCategory;
          const toastMethod =
            category === 'success'
              ? toast.success
              : category === 'warning'
                ? toast.warning
                : category === 'alert'
                  ? toast.error
                  : toast.info;

          toastMethod(notification.title, notification.message);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isAuthenticated, user?.id, toast]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      await inAppNotificationService.markAsRead(ids);
      setNotifications((prev) =>
        prev.map((n) =>
          ids.includes(n.id)
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    await inAppNotificationService.markAllAsRead();
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
        read_at: n.read_at || new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
  }, []);

  const archiveNotifications = useCallback(
    async (ids: string[]) => {
      await inAppNotificationService.archive(ids);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      const archivedUnread = notifications.filter(
        (n) => ids.includes(n.id) && !n.read,
      ).length;
      setUnreadCount((prev) => Math.max(0, prev - archivedUnread));
    },
    [notifications],
  );

  const deleteNotifications = useCallback(
    async (ids: string[]) => {
      await inAppNotificationService.deleteNotifications(ids);
      const deletedUnread = notifications.filter(
        (n) => ids.includes(n.id) && !n.read,
      ).length;
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setUnreadCount((prev) => Math.max(0, prev - deletedUnread));
    },
    [notifications],
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        refreshUnreadCount,
        markAsRead,
        markAllAsRead,
        archiveNotifications,
        deleteNotifications,
        totalPages,
        currentPage,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }
  return context;
}
