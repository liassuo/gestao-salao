import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/services/api';
import type { AuthContextType, LoginCredentials, LoginResponse, User } from './types';

const STORAGE_KEY_TOKEN = 'accessToken';
const STORAGE_KEY_USER = 'user';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar dados do localStorage na inicialização
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);

    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }

    setIsLoading(false);
  }, []);

  // Configurar interceptor para 401
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem(STORAGE_KEY_TOKEN);
          localStorage.removeItem(STORAGE_KEY_USER);
          delete api.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    const { accessToken: token, user: userData } = response.data;

    // Salvar no state
    setAccessToken(token);
    setUser(userData);

    // Salvar no localStorage
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));

    // Configurar header de autorização
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    delete api.defaults.headers.common['Authorization'];
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
