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
  DollarSign,
  Building2,
  Landmark,
  Package,
  Warehouse,
  ArrowLeftRight,
  ClipboardList,
  Tag,
} from 'lucide-react';
import type { Role } from '@/auth/roles';

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: Role[];
  group?: string; // Optional group for organizing in sidebar
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
    icon: ClipboardList,
    label: 'Comandas',
    path: '/comandas',
    roles: ['ADMIN'],
  },
  {
    icon: Tag,
    label: 'Promocoes',
    path: '/promocoes',
    roles: ['ADMIN'],
  },
  {
    icon: BarChart3,
    label: 'Relatórios',
    path: '/relatorios',
    roles: ['ADMIN'],
  },
  // Estoque group
  {
    icon: Package,
    label: 'Produtos',
    path: '/estoque/produtos',
    roles: ['ADMIN'],
    group: 'Estoque',
  },
  {
    icon: Warehouse,
    label: 'Estoque Atual',
    path: '/estoque/atual',
    roles: ['ADMIN'],
    group: 'Estoque',
  },
  {
    icon: ArrowLeftRight,
    label: 'Entrada e Saída',
    path: '/estoque/movimentacoes',
    roles: ['ADMIN'],
    group: 'Estoque',
  },
  // Financeiro group
  {
    icon: DollarSign,
    label: 'Comissoes',
    path: '/financeiro/comissoes',
    roles: ['ADMIN'],
    group: 'Financeiro',
  },
  // Cadastros group
  {
    icon: Building2,
    label: 'Filiais',
    path: '/financeiro/filiais',
    roles: ['ADMIN'],
    group: 'Cadastros',
  },
  {
    icon: Landmark,
    label: 'Contas Bancarias',
    path: '/financeiro/contas-bancarias',
    roles: ['ADMIN'],
    group: 'Cadastros',
  },
  {
    icon: CreditCard as LucideIcon,
    label: 'Formas Pagamento',
    path: '/financeiro/formas-pagamento',
    roles: ['ADMIN'],
    group: 'Cadastros',
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
