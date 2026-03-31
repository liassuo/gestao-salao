import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/auth';
import { ToastProvider } from '@/components/ui';
import { ThemeProvider, SidebarProvider, NotificationProvider } from '@/contexts';
import { router, clientRouter } from './routes';
import { IS_CLIENT_DOMAIN } from '@/client/utils/paths';

const activeRouter = IS_CLIENT_DOMAIN ? clientRouter : router;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// GOOGLE_CLIENT_ID deve ser configurado no .env
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function Providers() {
  const content = (
    <ThemeProvider>
      <SidebarProvider>
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <RouterProvider router={activeRouter} />
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </SidebarProvider>
    </ThemeProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          {content}
        </GoogleOAuthProvider>
      ) : (
        content
      )}
    </QueryClientProvider>
  );
}
