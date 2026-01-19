import { UserRole } from '@common/enums';

/**
 * DTO for updating user information
 * All fields are optional
 */
export class UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  professionalId?: string;
}
