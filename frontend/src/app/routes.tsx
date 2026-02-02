import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { PrivateRoute, RoleRoute } from '@/components/auth';
import {
  AccessDenied,
  AccountsPayable,
  AccountsReceivable,
  Appointments,
  Balance,
  BankAccounts,
  Branches,
  CashRegister,
  Clients,
  Commissions,
  CreateExpense,
  CreateRevenue,
  Dashboard,
  Debts,
  FinancialCategories,
  Login,
  Payments,
  PaymentMethods,
  Professionals,
  Reports,
  Services,
  Settings,
  Subscriptions,
} from '@/pages';
import { getRolesForPath } from '@/config/permissions';
import {
  ClientAuthProvider,
  ClientLayout,
  ClientPrivateRoute,
  ClientLogin,
  ClientHome,
  ClientBooking,
  ClientProfile,
} from '@/client';

// Helper para criar rota protegida por role
function withRoleProtection(path: string, element: React.ReactNode) {
  const roles = getRolesForPath(path);
  return (
    <RoleRoute roles={roles}>
      {element}
    </RoleRoute>
  );
}

export const router = createBrowserRouter([
  // Rotas do painel administrativo
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <Layout />
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'acesso-negado',
        element: <AccessDenied />,
      },
      {
        path: 'agendamentos',
        element: withRoleProtection('/agendamentos', <Appointments />),
      },
      {
        path: 'clientes',
        element: withRoleProtection('/clientes', <Clients />),
      },
      {
        path: 'servicos',
        element: withRoleProtection('/servicos', <Services />),
      },
      {
        path: 'assinaturas',
        element: withRoleProtection('/assinaturas', <Subscriptions />),
      },
      {
        path: 'profissionais',
        element: withRoleProtection('/profissionais', <Professionals />),
      },
      {
        path: 'pagamentos',
        element: withRoleProtection('/pagamentos', <Payments />),
      },
      {
        path: 'dividas',
        element: withRoleProtection('/dividas', <Debts />),
      },
      {
        path: 'caixa',
        element: withRoleProtection('/caixa', <CashRegister />),
      },
      {
        path: 'relatorios',
        element: withRoleProtection('/relatorios', <Reports />),
      },
      {
        path: 'financeiro/comissoes',
        element: withRoleProtection('/financeiro/comissoes', <Commissions />),
      },
      {
        path: 'financeiro/balanco',
        element: withRoleProtection('/financeiro/balanco', <Balance />),
      },
      {
        path: 'financeiro/contas-pagar',
        element: withRoleProtection('/financeiro/contas-pagar', <AccountsPayable />),
      },
      {
        path: 'financeiro/contas-receber',
        element: withRoleProtection('/financeiro/contas-receber', <AccountsReceivable />),
      },
      {
        path: 'financeiro/despesa',
        element: withRoleProtection('/financeiro/despesa', <CreateExpense />),
      },
      {
        path: 'financeiro/receita',
        element: withRoleProtection('/financeiro/receita', <CreateRevenue />),
      },
      {
        path: 'financeiro/filiais',
        element: withRoleProtection('/financeiro/filiais', <Branches />),
      },
      {
        path: 'financeiro/contas-bancarias',
        element: withRoleProtection('/financeiro/contas-bancarias', <BankAccounts />),
      },
      {
        path: 'financeiro/categorias',
        element: withRoleProtection('/financeiro/categorias', <FinancialCategories />),
      },
      {
        path: 'financeiro/formas-pagamento',
        element: withRoleProtection('/financeiro/formas-pagamento', <PaymentMethods />),
      },
      {
        path: 'configuracoes',
        element: withRoleProtection('/configuracoes', <Settings />),
      },
    ],
  },

  // Rotas do portal do cliente
  {
    path: '/cliente',
    element: (
      <ClientAuthProvider>
        <ClientLayout />
      </ClientAuthProvider>
    ),
    children: [
      {
        path: 'login',
        element: <ClientLogin />,
      },
      {
        index: true,
        element: (
          <ClientPrivateRoute>
            <ClientHome />
          </ClientPrivateRoute>
        ),
      },
      {
        path: 'agendar',
        element: (
          <ClientPrivateRoute>
            <ClientBooking />
          </ClientPrivateRoute>
        ),
      },
      {
        path: 'perfil',
        element: (
          <ClientPrivateRoute>
            <ClientProfile />
          </ClientPrivateRoute>
        ),
      },
    ],
  },
]);
