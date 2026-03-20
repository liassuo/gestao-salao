import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useSidebar } from '@/contexts';
import { subscribeAdminToPush } from '@/services/notifications';

export function Layout() {
  const { isCollapsed } = useSidebar();
  const pushSubscribed = useRef(false);

  useEffect(() => {
    if (!pushSubscribed.current) {
      pushSubscribed.current = true;
      subscribeAdminToPush();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors duration-200">
      <Sidebar />
      <Header />
      <main
        className={`pt-16 transition-all duration-300 ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
