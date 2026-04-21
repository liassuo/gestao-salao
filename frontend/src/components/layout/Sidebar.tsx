import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, DollarSign, Wrench, Package, X } from 'lucide-react';
import { useAuth } from '@/auth';
import { hasRole } from '@/auth/roles';
import { menuItems } from '@/config/permissions';
import type { MenuItem } from '@/config/permissions';
import { useSidebar } from '@/contexts';
import { useLowStockProducts } from '@/hooks';
import { BrandWordmark } from '@/components/ui';

const groupIcons: Record<string, React.ElementType> = {
  Estoque: Package,
  Financeiro: DollarSign,
  Cadastros: Wrench,
};

export function Sidebar() {
  const { user } = useAuth();
  const { isCollapsed, isMobileOpen, toggleSidebar, closeMobile } = useSidebar();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { data: lowStockProducts } = useLowStockProducts();
  const lowStockCount = lowStockProducts?.length || 0;

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

  const handleNavClick = () => {
    // Fecha sidebar mobile ao navegar
    closeMobile();
  };

  const renderNavItem = (item: MenuItem) => (
    <li key={item.path}>
      <NavLink
        to={item.path}
        onClick={handleNavClick}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
            isCollapsed && !isMobileOpen ? 'justify-center lg:justify-center' : ''
          } ${
            isActive
              ? 'bg-[#8B2020] text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30'
              : 'text-[var(--text-sidebar)] hover:bg-[#2C1F12] hover:text-[#F2E8D5]'
          }`
        }
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {(!isCollapsed || isMobileOpen) && <span>{item.label}</span>}
      </NavLink>
    </li>
  );

  const renderGroup = (groupName: string, items: MenuItem[]) => {
    const isExpanded = expandedGroups[groupName] || false;
    const isActive = isGroupActive(items);
    const GroupIcon = groupIcons[groupName] || DollarSign;

    // When sidebar is collapsed on desktop (not mobile), render items individually
    if (isCollapsed && !isMobileOpen) {
      return items.map((item) => renderNavItem(item));
    }

    return (
      <li key={groupName}>
        <button
          onClick={() => toggleGroup(groupName)}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium cursor-pointer transition-all duration-200 ${
            isActive
              ? 'bg-[#8B2020]/20 text-[#D4A85C]'
              : 'text-[var(--text-sidebar)] hover:bg-[#2C1F12] hover:text-[#F2E8D5]'
          }`}
        >
          <GroupIcon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 text-left">{groupName}</span>
          {groupName === 'Estoque' && lowStockCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {lowStockCount > 99 ? '99+' : lowStockCount}
            </span>
          )}
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
                  onClick={handleNavClick}
                  className={({ isActive: linkActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      linkActive
                        ? 'bg-[#8B2020] text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30'
                        : 'text-[var(--text-sidebar)] hover:bg-[#2C1F12] hover:text-[#F2E8D5]'
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

  // No mobile: sidebar é sempre expandida (w-64) quando aberta
  const showExpanded = isMobileOpen || !isCollapsed;

  return (
    <>
      {/* Backdrop mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] transition-all duration-300 ${
          isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Logo + fechar mobile */}
        <div className="flex h-24 shrink-0 items-center justify-between border-b border-[var(--border-sidebar)] px-4">
          <div className="flex items-center justify-center flex-1 min-w-0">
            {showExpanded ? (
              <BrandWordmark size="md" />
            ) : (
              <img
                src="/barbearia-america.png"
                alt="Barbearia América"
                className="h-12 w-12 object-contain"
              />
            )}
          </div>
          {/* Botão fechar no mobile */}
          {isMobileOpen && (
            <button
              onClick={closeMobile}
              className="lg:hidden rounded-lg p-1.5 text-[#8B7D6B] hover:bg-[#2C1F12] hover:text-[#F2E8D5]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Botão de retrair (desktop only) */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-24 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] text-[#8B7D6B] shadow-md transition-colors hover:bg-[#2C1F12] hover:text-[#F2E8D5]"
          title={isCollapsed ? 'Expandir menu' : 'Retrair menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <nav className="mt-6 flex-1 overflow-y-auto px-3 pb-4">
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
        <div className="shrink-0 border-t border-[var(--border-sidebar)] p-4">
          {showExpanded && (
            <p className="text-center text-xs text-[#8B7D6B]">
              Barbearia America
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
