/**
 * Client domain entity
 * Represents customers who book appointments
 * Can authenticate via app (email/password or Google)
 */
export class Client {
  id: string;
  name: string;
  email?: string; // Optional: Many barbershop clients don't have email
  phone: string;
  password?: string; // Optional: null if using Google auth

  /**
   * Google OAuth ID if using social login
   */
  googleId?: string;

  /**
   * Indicates if client has active debts
   * IMPORTANT: This is a derived field for performance
   * Always update when debts change to avoid inconsistency
   */
  hasDebts: boolean;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Additional info for better customer service
   */
  notes?: string;
}
