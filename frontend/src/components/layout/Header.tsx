import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Sun, Moon, Menu, Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme, useSidebar, useNotifications } from '@/contexts';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, openMobile } = useSidebar();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      ADMIN: 'Administrador',
      PROFESSIONAL: 'Profissional',
    };
    return roles[role] || role;
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.read) {
      await markAsRead([notification.id]);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
      setShowDropdown(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    if (diffH < 24) return `${diffH}h`;
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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

  const recentNotifications = notifications.slice(0, 8);

  return (
    <header
      className={`fixed right-0 top-0 z-30 h-16 border-b border-[var(--border-color)] bg-[var(--bg-header)] backdrop-blur-xl transition-all duration-300 left-0 ${
        isCollapsed ? 'lg:left-20' : 'lg:left-64'
      }`}
    >
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Hamburger - mobile only */}
          <button
            onClick={openMobile}
            className="lg:hidden rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h2 className="text-base lg:text-lg font-semibold text-[var(--text-primary)]">
            Painel Administrativo
          </h2>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="relative rounded-xl p-2 sm:p-2.5 text-[var(--text-muted)] transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              title="Notificações"
              className="relative rounded-xl p-2 sm:p-2.5 text-[var(--text-muted)] transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8B2020] px-1 text-[10px] font-bold text-white shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden z-50 bg-[var(--bg-secondary)]">
                {/* Header do dropdown */}
                <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Notificações
                    {unreadCount > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8B2020]/20 px-1.5 text-xs font-bold text-[#A63030]">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar todas
                    </button>
                  )}
                </div>

                {/* Lista */}
                <div className="max-h-[400px] overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
                      <Bell className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma notificação</p>
                    </div>
                  ) : (
                    recentNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 transition-colors hover:bg-[var(--hover-bg)] ${
                          !notification.read
                            ? 'bg-[#8B2020]/5'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Indicador de categoria */}
                          <div
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${getCategoryColor(
                              notification.displayCategory,
                            )}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`text-sm truncate ${
                                  !notification.read
                                    ? 'font-semibold text-[var(--text-primary)]'
                                    : 'font-medium text-[var(--text-secondary)]'
                                }`}
                              >
                                {notification.title}
                              </p>
                              <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                {formatTimeAgo(notification.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead([notification.id]);
                              }}
                              title="Marcar como lida"
                              className="mt-1 shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="border-t border-[var(--border-color)] px-4 py-2.5">
                    <button
                      onClick={() => {
                        navigate('/notificacoes');
                        setShowDropdown(false);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-[#A63030] hover:text-[#8B2020] transition-colors"
                    >
                      Ver todas as notificações
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 border-l border-[var(--border-color)] pl-2 sm:pl-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B2020] to-[#A63030] text-[#F2E8D5] shadow-lg shadow-[#8B2020]/20">
              <User className="h-5 w-5" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {user?.name || 'Usuário'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {user?.role ? getRoleLabel(user.role) : ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="rounded-xl p-2 sm:p-2.5 text-[var(--text-muted)] transition-all hover:bg-[#8B2020]/10 hover:text-[#A63030]"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
