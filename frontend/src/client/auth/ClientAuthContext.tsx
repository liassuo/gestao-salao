import { createContext, useCallback, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { clientAuthApi, storage, setClientLogoutCallback } from '../services/api';
import type { ClientUser } from '../types';

interface ClientAuthContextType {
  user: ClientUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword?: boolean }>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone: string, birthDate?: string) => Promise<void>;
  setupPassword: (password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<ClientUser>) => void;
}

export const ClientAuthContext = createContext<ClientAuthContextType | null>(null);

interface ClientAuthProviderProps {
  children: ReactNode;
}

export function ClientAuthProvider({ children }: ClientAuthProviderProps) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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

  const login = useCallback(async (email: string, password: string): Promise<{ mustChangePassword?: boolean }> => {
    const response = await clientAuthApi.login(email, password);
    const { accessToken: token, user: userData, mustChangePassword: needsPassword } = response;

    setAccessToken(token);
    setUser(userData);
    storage.setToken(token);

    if (needsPassword) {
      setMustChangePassword(true);
      return { mustChangePassword: true };
    }

    storage.setUser(userData);
    return {};
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const response = await clientAuthApi.googleLogin(credential);
    const { accessToken: token, user: userData } = response;

    setAccessToken(token);
    setUser(userData);

    storage.setToken(token);
    storage.setUser(userData);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone: string, birthDate?: string) => {
    const response = await clientAuthApi.register(name, email, password, phone, birthDate);
    const { accessToken: token, user: userData } = response;

    setAccessToken(token);
    setUser(userData);

    storage.setToken(token);
    storage.setUser(userData);
  }, []);

  const setupPassword = useCallback(async (password: string) => {
    const response = await clientAuthApi.setupPassword(password);
    const { accessToken: token, user: userData } = response;

    setAccessToken(token);
    setUser(userData);
    setMustChangePassword(false);

    storage.setToken(token);
    storage.setUser(userData);
  }, []);

  const updateUser = useCallback((data: Partial<ClientUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      storage.setUser(updated);
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!accessToken && !!user,
      isLoading,
      mustChangePassword,
      login,
      loginWithGoogle,
      register,
      setupPassword,
      logout,
      updateUser,
    }),
    [user, accessToken, isLoading, mustChangePassword, login, loginWithGoogle, register, setupPassword, logout, updateUser]
  );

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}
