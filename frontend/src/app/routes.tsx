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
  Services,
} from '@/pages';
import { getRolesForPath } from '@/config/permissions';

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
        path: 'access-denied',
        element: <AccessDenied />,
      },
      {
        path: 'appointments',
        element: withRoleProtection('/appointments', <Appointments />),
      },
      {
        path: 'clients',
        element: withRoleProtection('/clients', <Clients />),
      },
      {
        path: 'services',
        element: withRoleProtection('/services', <Services />),
      },
      {
        path: 'professionals',
        element: withRoleProtection('/professionals', <Professionals />),
      },
      {
        path: 'payments',
        element: withRoleProtection('/payments', <Payments />),
      },
      {
        path: 'debts',
        element: withRoleProtection('/debts', <Debts />),
      },
      {
        path: 'cash-register',
        element: withRoleProtection('/cash-register', <CashRegister />),
      },
      {
        path: 'settings',
        element: withRoleProtection('/settings', <PlaceholderPage title="Configurações" />),
      },
    ],
  },
]);

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">{title}</h1>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-gray-500">Página em construção...</p>
      </div>
    </div>
  );
}
