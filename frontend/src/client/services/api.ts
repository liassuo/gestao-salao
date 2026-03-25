import axios from 'axios';
import type { ClientLoginResponse, ClientUser } from '../types';

const STORAGE_KEY_TOKEN = 'clientAccessToken';
const STORAGE_KEY_USER = 'clientUser';

export const clientApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Restaurar token do localStorage
const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
if (storedToken) {
  clientApi.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

let logoutCallback: (() => void) | null = null;

export const setClientLogoutCallback = (callback: () => void) => {
  logoutCallback = callback;
};

// Interceptor para adicionar token
clientApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para lidar com 401
clientApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
      delete clientApi.defaults.headers.common['Authorization'];
      if (logoutCallback) {
        logoutCallback();
      }
    }
    return Promise.reject(error);
  }
);

export interface CheckEmailResponse {
  status: 'new' | 'login' | 'setup_password' | 'google';
  name?: string;
}

export const clientAuthApi = {
  checkEmail: async (email: string): Promise<CheckEmailResponse> => {
    const response = await clientApi.post<CheckEmailResponse>('/auth/client/check-email', { email });
    return response.data;
  },
  initSetupPassword: async (email: string, password: string): Promise<ClientLoginResponse> => {
    const response = await clientApi.post<ClientLoginResponse>('/auth/client/init-setup-password', { email, password });
    return response.data;
  },
  login: async (email: string, password: string): Promise<ClientLoginResponse> => {
    const response = await clientApi.post<ClientLoginResponse>('/auth/client/login', {
      email,
      password,
    });
    return response.data;
  },
  googleLogin: async (credential: string): Promise<ClientLoginResponse> => {
    const response = await clientApi.post<ClientLoginResponse>('/auth/client/google', {
      credential,
    });
    return response.data;
  },
  register: async (name: string, email: string, password: string, phone: string, birthDate?: string): Promise<ClientLoginResponse> => {
    const response = await clientApi.post<ClientLoginResponse>('/auth/client/register', {
      name,
      email,
      password,
      phone,
      birthDate,
    });
    return response.data;
  },
  setupPassword: async (password: string): Promise<ClientLoginResponse> => {
    const response = await clientApi.post<ClientLoginResponse>('/auth/client/setup-password', {
      password,
    });
    return response.data;
  },
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await clientApi.post<{ message: string }>('/auth/client/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const response = await clientApi.post<{ message: string }>('/auth/client/reset-password', { token, password });
    return response.data;
  },
};

export const storage = {
  getToken: () => localStorage.getItem(STORAGE_KEY_TOKEN),
  setToken: (token: string) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    clientApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  removeToken: () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    delete clientApi.defaults.headers.common['Authorization'];
  },
  getUser: (): ClientUser | null => {
    const user = localStorage.getItem(STORAGE_KEY_USER);
    return user ? JSON.parse(user) : null;
  },
  setUser: (user: ClientUser) => {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  },
  removeUser: () => {
    localStorage.removeItem(STORAGE_KEY_USER);
  },
};
