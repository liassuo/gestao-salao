import { Navigate, useLocation } from 'react-router-dom';
import { useClientAuth } from '../../auth';

interface ClientPrivateRouteProps {
  children: React.ReactNode;
}

export function ClientPrivateRoute({ children }: ClientPrivateRouteProps) {
  const { isAuthenticated, isLoading } = useClientAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8923A]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/cliente/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
