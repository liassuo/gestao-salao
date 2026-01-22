import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth';
import { hasRole } from '@/auth/roles';
import { menuItems } from '@/config/permissions';

export function Sidebar() {
  const { user } = useAuth();

  // Filtra itens de menu baseado na role do usuário
  const visibleItems = menuItems.filter((item) => hasRole(user, item.roles));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Barbearia</h1>
      </div>

      <nav className="mt-4 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
