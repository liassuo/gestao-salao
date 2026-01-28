import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { hasRole } from '@/auth/roles';
import type { Role } from '@/auth/roles';

interface RoleRouteProps {
  children: React.ReactNode;
  roles: Role[];
  redirectTo?: string;
}

export function RoleRoute({
  children,
  roles,
  redirectTo = '/acesso-negado',
}: RoleRouteProps) {
  const { user } = useAuth();

  if (!hasRole(user, roles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
