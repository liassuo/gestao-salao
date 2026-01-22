import type { User } from './types';

export type Role = 'ADMIN' | 'PROFESSIONAL';

export const ROLES = {
  ADMIN: 'ADMIN',
  PROFESSIONAL: 'PROFESSIONAL',
} as const;

export function hasRole(user: User | null, allowedRoles: Role[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, [ROLES.ADMIN]);
}

export function isProfessional(user: User | null): boolean {
  return hasRole(user, [ROLES.PROFESSIONAL]);
}
