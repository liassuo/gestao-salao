export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'PROFESSIONAL';
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  mustChangePassword?: boolean;
}

export interface AuthContextType extends AuthState {
  mustChangePassword: boolean;
  login: (credentials: LoginCredentials) => Promise<{ mustChangePassword?: boolean }>;
  setupPassword: (password: string) => Promise<void>;
  logout: () => void;
}
