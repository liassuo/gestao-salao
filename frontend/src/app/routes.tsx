import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Dashboard } from '@/pages';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'appointments',
        element: <PlaceholderPage title="Agendamentos" />,
      },
      {
        path: 'clients',
        element: <PlaceholderPage title="Clientes" />,
      },
      {
        path: 'services',
        element: <PlaceholderPage title="Serviços" />,
      },
      {
        path: 'professionals',
        element: <PlaceholderPage title="Profissionais" />,
      },
      {
        path: 'payments',
        element: <PlaceholderPage title="Pagamentos" />,
      },
      {
        path: 'debts',
        element: <PlaceholderPage title="Dívidas" />,
      },
      {
        path: 'cash-register',
        element: <PlaceholderPage title="Caixa" />,
      },
      {
        path: 'settings',
        element: <PlaceholderPage title="Configurações" />,
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
