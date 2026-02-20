import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Sun, Moon, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme, useSidebar } from '@/contexts';
import { useLowStockProducts } from '@/hooks';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const { data: lowStockProducts } = useLowStockProducts();
  const lowStockCount = lowStockProducts?.length || 0;

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

          {/* Notifications / Low Stock Alert */}
          <button
            onClick={() => lowStockCount > 0 && navigate('/estoque/atual')}
            title={lowStockCount > 0 ? `${lowStockCount} produto(s) com estoque baixo` : 'Sem alertas'}
            className={`relative rounded-xl p-2.5 transition-colors hover:bg-[var(--hover-bg)] ${
              lowStockCount > 0
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {lowStockCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            {lowStockCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--bg-header)]">
                {lowStockCount > 99 ? '99+' : lowStockCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-3 border-l border-[var(--border-color)] pl-4">
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
              className="rounded-xl p-2.5 text-[var(--text-muted)] transition-all hover:bg-[#8B2020]/10 hover:text-[#A63030]"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
