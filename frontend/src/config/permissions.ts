import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  Scissors,
  CreditCard,
  Receipt,
  Wallet,
  Settings,
} from 'lucide-react';
import type { Role } from '@/auth/roles';

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: Role[];
}

// Configuração central: menu + permissões por role
export const menuItems: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/',
    roles: ['ADMIN', 'PROFESSIONAL'],
  },
  {
    icon: Calendar,
    label: 'Agendamentos',
    path: '/appointments',
    roles: ['ADMIN', 'PROFESSIONAL'],
  },
  {
    icon: Users,
    label: 'Clientes',
    path: '/clients',
    roles: ['ADMIN', 'PROFESSIONAL'],
  },
  {
    icon: Scissors,
    label: 'Serviços',
    path: '/services',
    roles: ['ADMIN'],
  },
  {
    icon: UserCog,
    label: 'Profissionais',
    path: '/professionals',
    roles: ['ADMIN'],
  },
  {
    icon: CreditCard,
    label: 'Pagamentos',
    path: '/payments',
    roles: ['ADMIN'],
  },
  {
    icon: Receipt,
    label: 'Dívidas',
    path: '/debts',
    roles: ['ADMIN'],
  },
  {
    icon: Wallet,
    label: 'Caixa',
    path: '/cash-register',
    roles: ['ADMIN'],
  },
  {
    icon: Settings,
    label: 'Configurações',
    path: '/settings',
    roles: ['ADMIN'],
  },
];

// Helper para buscar roles de uma rota
export function getRolesForPath(path: string): Role[] {
  const item = menuItems.find((i) => i.path === path);
  return item?.roles || ['ADMIN'];
}
