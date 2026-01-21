import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '@/auth';

export function Header() {
  const { user, logout } = useAuth();
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
    <header className="fixed left-64 right-0 top-0 z-30 h-16 border-b border-gray-200 bg-white">
      <div className="flex h-full items-center justify-between px-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Painel Administrativo
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
              <User className="h-5 w-5" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-800">
                {user?.name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role ? getRoleLabel(user.role) : ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-500"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
