import { UserRole } from '@common/enums';

/**
 * DTO for creating a new user
 */
export class CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;

  /**
   * Optional: Link to professional entity if role is PROFESSIONAL
   */
  professionalId?: string;
}
