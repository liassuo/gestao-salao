import { Outlet } from 'react-router-dom';
import { useClientAuth } from '../../auth';
import { IOSInstallBanner } from '../IOSInstallBanner';

export function ClientLayout() {
  const { isLoading } = useClientAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8923A]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Outlet />
      <IOSInstallBanner />
    </div>
  );
}
