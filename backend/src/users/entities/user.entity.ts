import { UserRole } from '@common/enums';

/**
 * User domain entity
 * Represents authenticated users who access the admin panel
 * Can be ADMIN or PROFESSIONAL
 */
export class User {
  id: string;
  email: string;
  password: string; // Will be hashed
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Optional: Reference to Professional entity if role is PROFESSIONAL
   * Links user account to professional schedule and services
   */
  professionalId?: string;
}
