import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, DollarSign, Wrench } from 'lucide-react';
import { useAuth } from '@/auth';
import { hasRole } from '@/auth/roles';
import { menuItems } from '@/config/permissions';
import type { MenuItem } from '@/config/permissions';
import { useSidebar } from '@/contexts';

const groupIcons: Record<string, React.ElementType> = {
  Financeiro: DollarSign,
  Cadastros: Wrench,
};

export function Sidebar() {
  const { user } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Filtra itens de menu baseado na role do usuário
  const visibleItems = menuItems.filter((item) => hasRole(user, item.roles));

  // Separate ungrouped and grouped items
  const ungroupedItems = visibleItems.filter((item) => !item.group);
  const groupedItems = visibleItems.filter((item) => item.group);

  // Build ordered groups preserving insertion order
  const groupOrder: string[] = [];
  const groups: Record<string, MenuItem[]> = {};
  for (const item of groupedItems) {
    const g = item.group!;
    if (!groups[g]) {
      groups[g] = [];
      groupOrder.push(g);
    }
    groups[g].push(item);
  }

  // Determine where to insert groups: before "Configurações" (last ungrouped item)
  // Split ungrouped items into before-config and config
  const configIndex = ungroupedItems.findIndex((item) => item.path === '/configuracoes');
  const beforeConfig = configIndex >= 0 ? ungroupedItems.slice(0, configIndex) : ungroupedItems;
  const afterConfig = configIndex >= 0 ? ungroupedItems.slice(configIndex) : [];

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const isGroupActive = (groupItems: MenuItem[]) => {
    return groupItems.some((item) => location.pathname === item.path);
  };

  const renderNavItem = (item: MenuItem) => (
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
  );

  const renderGroup = (groupName: string, items: MenuItem[]) => {
    const isExpanded = expandedGroups[groupName] || false;
    const isActive = isGroupActive(items);
    const GroupIcon = groupIcons[groupName] || DollarSign;

    // When sidebar is collapsed, render items individually with tooltips
    if (isCollapsed) {
      return items.map((item) => renderNavItem(item));
    }

    return (
      <li key={groupName}>
        <button
          onClick={() => toggleGroup(groupName)}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium cursor-pointer transition-all duration-200 ${
            isActive
              ? 'bg-red-600/20 text-red-400'
              : 'text-[var(--text-sidebar)] hover:bg-zinc-800 hover:text-white'
          }`}
        >
          <GroupIcon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 text-left">{groupName}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {isExpanded && (
          <ul className="ml-4 mt-1 space-y-1">
            {items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive: linkActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      linkActive
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'text-[var(--text-sidebar)] hover:bg-zinc-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

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

      <nav className="mt-6 overflow-y-auto px-3" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        <ul className="space-y-1">
          {/* Ungrouped items before config */}
          {beforeConfig.map((item) => renderNavItem(item))}

          {/* Grouped items */}
          {groupOrder.map((groupName) => renderGroup(groupName, groups[groupName]))}

          {/* Config and remaining ungrouped items */}
          {afterConfig.map((item) => renderNavItem(item))}
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
