export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
  hasDebts: boolean;
  isActive: boolean;
  birthDate?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  lastVisitAt?: string | null;
  notes?: string | null;
  asaasCustomerId?: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    appointments: number;
    debts: number;
  };
}

export interface ClientFilters {
  search?: string;
  hasDebts?: boolean;
  isActive?: boolean;
}

export interface CreateClientPayload {
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  birthDate?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export interface UpdateClientPayload {
  name?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birthDate?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  isActive?: boolean;
}
