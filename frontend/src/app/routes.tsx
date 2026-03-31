import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { PrivateRoute, RoleRoute } from '@/components/auth';
import { useAuth } from '@/auth';
import {
  AccessDenied,
  Appointments,
  Branches,
  CashRegister,
  Clients,
  Commissions,
  Dashboard,
  Debts,
  Login,
  Orders,
  Payments,
  PaymentMethods,
  Products,
  Professionals,
  Promotions,
  Reports,
  Services,
  SetPassword,
  Settings,
  StockCurrent,
  StockMovements,
  Subscriptions,
  ForgotPassword,
  ResetPassword,
  Notifications,
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
  ClientSetPassword,
  ClientPlans,
  ClientForgotPassword,
  ClientResetPassword,
} from '@/client';

// Redireciona profissionais para /agendamentos, admin para Dashboard
function RoleBasedHome() {
  const { user } = useAuth();
  if (user?.role === 'PROFESSIONAL') {
    return <Navigate to="/agendamentos" replace />;
  }
  return <Dashboard />;
}

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
    path: '/criar-senha',
    element: <SetPassword />,
  },
  {
    path: '/recuperar-senha',
    element: <ForgotPassword />,
  },
  {
    path: '/redefinir-senha',
    element: <ResetPassword />,
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
        element: <RoleBasedHome />,
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
        path: 'comandas',
        element: withRoleProtection('/comandas', <Orders />),
      },
      {
        path: 'promocoes',
        element: withRoleProtection('/promocoes', <Promotions />),
      },
      {
        path: 'relatorios',
        element: withRoleProtection('/relatorios', <Reports />),
      },
      {
        path: 'estoque/produtos',
        element: withRoleProtection('/estoque/produtos', <Products />),
      },
      {
        path: 'estoque/atual',
        element: withRoleProtection('/estoque/atual', <StockCurrent />),
      },
      {
        path: 'estoque/movimentacoes',
        element: withRoleProtection('/estoque/movimentacoes', <StockMovements />),
      },
      {
        path: 'financeiro/comissoes',
        element: withRoleProtection('/financeiro/comissoes', <Commissions />),
      },
      {
        path: 'financeiro/filiais',
        element: withRoleProtection('/financeiro/filiais', <Branches />),
      },
      {
        path: 'financeiro/formas-pagamento',
        element: withRoleProtection('/financeiro/formas-pagamento', <PaymentMethods />),
      },
      {
        path: 'notificacoes',
        element: <Notifications />,
      },
      {
        path: 'configuracoes',
        element: withRoleProtection('/configuracoes', <Settings />),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },

  // Rotas do portal do cliente (acesso via /cliente em localhost/admin)
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
        path: 'criar-senha',
        element: <ClientSetPassword />,
      },
      {
        path: 'esqueceu-senha',
        element: <ClientForgotPassword />,
      },
      {
        path: 'recuperar-senha',
        element: <ClientResetPassword />,
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
      {
        path: 'planos',
        element: (
          <ClientPrivateRoute>
            <ClientPlans />
          </ClientPrivateRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/cliente" replace />,
      },
    ],
  },
]);

// Router do portal do cliente para barbeariaamerica.com.br (rotas na raiz)
export const clientRouter = createBrowserRouter([
  {
    path: '/',
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
        path: 'criar-senha',
        element: <ClientSetPassword />,
      },
      {
        path: 'esqueceu-senha',
        element: <ClientForgotPassword />,
      },
      {
        path: 'recuperar-senha',
        element: <ClientResetPassword />,
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
      {
        path: 'planos',
        element: (
          <ClientPrivateRoute>
            <ClientPlans />
          </ClientPrivateRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
