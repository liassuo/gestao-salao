import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme, useSidebar } from '@/contexts';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();

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

  return (
    <header
      className={`fixed right-0 top-0 z-30 h-16 border-b border-[var(--border-color)] bg-[var(--bg-header)] backdrop-blur-xl transition-all duration-300 ${
        isCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="flex h-full items-center justify-between px-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Painel Administrativo
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="relative rounded-xl p-2.5 text-[var(--text-muted)] transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          {/* Notifications */}
          <button className="relative rounded-xl p-2.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg-secondary)]" />
          </button>

          <div className="flex items-center gap-3 border-l border-[var(--border-color)] pl-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-500 text-white shadow-lg shadow-red-600/20">
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
              className="rounded-xl p-2.5 text-[var(--text-muted)] transition-all hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
