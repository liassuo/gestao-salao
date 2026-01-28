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
  BarChart3,
  Settings,
  BadgeCheck,
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
    path: '/agendamentos',
    roles: ['ADMIN', 'PROFESSIONAL'],
  },
  {
    icon: Users,
    label: 'Clientes',
    path: '/clientes',
    roles: ['ADMIN', 'PROFESSIONAL'],
  },
  {
    icon: Scissors,
    label: 'Servicos',
    path: '/servicos',
    roles: ['ADMIN'],
  },
  {
    icon: BadgeCheck,
    label: 'Assinaturas',
    path: '/assinaturas',
    roles: ['ADMIN'],
  },
  {
    icon: UserCog,
    label: 'Profissionais',
    path: '/profissionais',
    roles: ['ADMIN'],
  },
  {
    icon: CreditCard,
    label: 'Pagamentos',
    path: '/pagamentos',
    roles: ['ADMIN'],
  },
  {
    icon: Receipt,
    label: 'Dívidas',
    path: '/dividas',
    roles: ['ADMIN'],
  },
  {
    icon: Wallet,
    label: 'Caixa',
    path: '/caixa',
    roles: ['ADMIN'],
  },
  {
    icon: BarChart3,
    label: 'Relatórios',
    path: '/relatorios',
    roles: ['ADMIN'],
  },
  {
    icon: Settings,
    label: 'Configurações',
    path: '/configuracoes',
    roles: ['ADMIN'],
  },
];

// Helper para buscar roles de uma rota
export function getRolesForPath(path: string): Role[] {
  const item = menuItems.find((i) => i.path === path);
  return item?.roles || ['ADMIN'];
}
