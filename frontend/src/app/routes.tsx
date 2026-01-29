import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { PrivateRoute, RoleRoute } from '@/components/auth';
import {
  AccessDenied,
  Appointments,
  CashRegister,
  Clients,
  Dashboard,
  Debts,
  Login,
  Payments,
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
