import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/auth';
import { hasRole } from '@/auth/roles';
import { menuItems } from '@/config/permissions';
import { useSidebar } from '@/contexts';

export function Sidebar() {
  const { user } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  // Filtra itens de menu baseado na role do usuário
  const visibleItems = menuItems.filter((item) => hasRole(user, item.roles));

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-[var(--border-sidebar)] px-4">
        {isCollapsed ? (
          <img
            src="/barbearia-america.png"
            alt="Barbearia América"
            className="h-10 w-10 object-contain"
          />
        ) : (
          <img
            src="/barbearia-america.png"
            alt="Barbearia América"
            className="h-12 w-auto"
          />
        )}
      </div>

      {/* Botão de retrair */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-24 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] text-zinc-400 shadow-md transition-colors hover:bg-zinc-800 hover:text-white"
        title={isCollapsed ? 'Expandir menu' : 'Retrair menu'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      <nav className="mt-6 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                      : 'text-[var(--text-sidebar)] hover:bg-zinc-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer da sidebar */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border-sidebar)] p-4">
        {!isCollapsed && (
          <p className="text-center text-xs text-zinc-600">
            Barbearia America
          </p>
        )}
      </div>
    </aside>
  );
}
