export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number; // centavos
  duration: number; // minutos (backend usa 'duration')
  durationMinutes?: number; // alias para compatibilidade
  fichas?: number; // fichas para comissão de assinatura (0 = usa duration)
  displayOrder?: number; // ordem de exibição nas listas (menor primeiro)
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateServicePayload {
  name: string;
  description?: string;
  price: number; // centavos
  duration: number; // minutos
  fichas?: number;
  displayOrder?: number;
}

export interface UpdateServicePayload {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  fichas?: number;
  displayOrder?: number;
  isActive?: boolean;
}
