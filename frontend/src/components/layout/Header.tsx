import { useNavigate } from 'react-router-dom';
import { LogOut, User, Sun, Moon, Menu } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme, useSidebar } from '@/contexts';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, openMobile } = useSidebar();
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
