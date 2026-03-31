import { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts';
import type { Notification } from '@/types/notification';
import { NOTIFICATION_TYPE_LABELS } from '@/types/notification';

type FilterTab = 'all' | 'unread' | 'read';

export function Notifications() {
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotifications,
    deleteNotifications,
    totalPages,
    currentPage,
  } = useNotifications();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleFilterChange = (newFilter: FilterTab) => {
    setFilter(newFilter);
    setSelectedIds(new Set());
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const handleBulkRead = async () => {
    const ids = Array.from(selectedIds);
    await markAsRead(ids);
    setSelectedIds(new Set());
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    await archiveNotifications(ids);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await deleteNotifications(ids);
    setSelectedIds(new Set());
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead([notification.id]);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin} min atrás`;
    if (diffH < 24) return `${diffH}h atrás`;
    if (diffD < 7) return `${diffD} dia${diffD > 1 ? 's' : ''} atrás`;
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'success':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'alert':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'success':
        return 'bg-emerald-500/10';
      case 'warning':
        return 'bg-amber-500/10';
      case 'alert':
        return 'bg-red-500/10';
      default:
        return 'bg-blue-500/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Notificações
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {unreadCount > 0
              ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
              : 'Todas as notificações lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 rounded-xl bg-[#8B2020]/10 px-4 py-2 text-sm font-medium text-[#A63030] hover:bg-[#8B2020]/20 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--text-muted)]" />
        {(['all', 'unread', 'read'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleFilterChange(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-[#8B2020] text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab === 'all' ? 'Todas' : tab === 'unread' ? 'Não lidas' : 'Lidas'}
          </button>
        ))}
      </div>

      {/* Ações em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
          <span className="text-sm text-[var(--text-muted)]">
            {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={handleBulkRead}
              title="Marcar como lidas"
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-emerald-500"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleBulkArchive}
              title="Arquivar"
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-amber-500"
            >
              <Archive className="h-4 w-4" />
            </button>
            <button
              onClick={handleBulkDelete}
              title="Excluir"
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de notificações */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
        {/* Select all header */}
        {filteredNotifications.length > 0 && (
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] px-4 py-2.5">
            <input
              type="checkbox"
              checked={
                selectedIds.size === filteredNotifications.length &&
                filteredNotifications.length > 0
              }
              onChange={selectAll}
              className="h-4 w-4 rounded border-[var(--border-color)] accent-[#8B2020]"
            />
            <span className="text-xs text-[var(--text-muted)]">Selecionar todas</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B2020] border-t-transparent" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
            <Bell className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-base font-medium">Nenhuma notificação</p>
            <p className="text-sm mt-1">
              {filter === 'unread'
                ? 'Todas as notificações foram lidas'
                : 'Você não tem notificações ainda'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 border-b border-[var(--border-color)] last:border-b-0 px-4 py-4 transition-colors hover:bg-[var(--hover-bg)] ${
                !notification.read ? 'bg-[#8B2020]/5' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(notification.id)}
                onChange={() => toggleSelect(notification.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-color)] accent-[#8B2020]"
              />

              <div
                className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getCategoryBg(
                  notification.displayCategory,
                )}`}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${getCategoryColor(
                    notification.displayCategory,
                  )}`}
                />
              </div>

              <button
                onClick={() => handleNotificationClick(notification)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm ${
                      !notification.read
                        ? 'font-semibold text-[var(--text-primary)]'
                        : 'font-medium text-[var(--text-secondary)]'
                    }`}
                  >
                    {notification.title}
                  </p>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {notification.message}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)] opacity-60">
                    {NOTIFICATION_TYPE_LABELS[notification.type] || notification.type}
                  </span>
                  {notification.actor?.name && (
                    <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                      por {notification.actor.name}
                    </span>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                {!notification.read && (
                  <button
                    onClick={() => markAsRead([notification.id])}
                    title="Marcar como lida"
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-emerald-500"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => archiveNotifications([notification.id])}
                  title="Arquivar"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-amber-500"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchNotifications(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => fetchNotifications(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
