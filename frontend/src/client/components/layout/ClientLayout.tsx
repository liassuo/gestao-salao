import { Outlet } from 'react-router-dom';
import { useClientAuth } from '../../auth';
import { IOSInstallBanner } from '../IOSInstallBanner';
import { BrandWordmark } from '@/components/ui';

export function ClientLayout() {
  const { isLoading, isAuthenticated } = useClientAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8923A]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {isAuthenticated && (
        <div className="relative border-b border-[#3D2B1F]/60 bg-gradient-to-b from-[#1E1610]/60 to-transparent px-5 pt-4 pb-3">
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/30 to-transparent" />
          <BrandWordmark size="sm" />
        </div>
      )}
      <Outlet />
      <IOSInstallBanner />
    </div>
  );
}
