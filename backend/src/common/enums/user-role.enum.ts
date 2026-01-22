/**
 * User roles in the system
 * ADMIN: Full system access, manages all resources
 * PROFESSIONAL: Limited access, manages their own schedule and services
 * CLIENT: Client access for booking appointments
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  PROFESSIONAL = 'PROFESSIONAL',
  CLIENT = 'CLIENT',
}
