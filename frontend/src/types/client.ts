export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  hasDebts: boolean;
  isActive: boolean;
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
  notes?: string;
}

export interface UpdateClientPayload {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive?: boolean;
}
