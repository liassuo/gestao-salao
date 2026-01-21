import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/auth';
import { router } from './routes';

export function Providers() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
