export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number; // centavos
  duration: number; // minutos (backend usa 'duration')
  durationMinutes?: number; // alias para compatibilidade
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateServicePayload {
  name: string;
  description?: string;
  price: number; // centavos
  duration: number; // minutos
}

export interface UpdateServicePayload {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  isActive?: boolean;
}
