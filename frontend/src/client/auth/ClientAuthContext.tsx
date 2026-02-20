import { createContext, useCallback, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { clientAuthApi, storage, setClientLogoutCallback } from '../services/api';
import type { ClientUser } from '../types';

interface ClientAuthContextType {
  user: ClientUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

export const ClientAuthContext = createContext<ClientAuthContextType | null>(null);

interface ClientAuthProviderProps {
  children: ReactNode;
}

export function ClientAuthProvider({ children }: ClientAuthProviderProps) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    storage.removeToken();
    storage.removeUser();
  }, []);

  // Configurar callback de logout para o interceptor
  useEffect(() => {
    setClientLogoutCallback(logout);
  }, [logout]);

  // Carregar dados do localStorage na inicializacao
  useEffect(() => {
    const storedToken = storage.getToken();
    const storedUser = storage.getUser();

    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(storedUser);
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await clientAuthApi.login(email, password);
    const { accessToken: token, user: userData } = response;

    setAccessToken(token);
    setUser(userData);

    storage.setToken(token);
    storage.setUser(userData);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const response = await clientAuthApi.googleLogin(credential);
    const { accessToken: token, user: userData } = response;

    setAccessToken(token);
    setUser(userData);

    storage.setToken(token);
    storage.setUser(userData);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!accessToken && !!user,
      isLoading,
      login,
      loginWithGoogle,
      logout,
    }),
    [user, accessToken, isLoading, login, loginWithGoogle, logout]
  );

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}
