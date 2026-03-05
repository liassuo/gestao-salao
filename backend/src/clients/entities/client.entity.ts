/**
 * Client domain entity
 * Represents customers who book appointments
 * Can authenticate via app (email/password or Google)
 */
export class Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
  password?: string;
  googleId?: string;
  hasDebts: boolean;
  isActive: boolean;
  birthDate?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lastVisitAt?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
