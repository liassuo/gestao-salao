/**
 * DTO for creating a new client
 */
export class CreateClientDto {
  name: string;
  email: string;
  phone: string;
  password?: string;
  googleId?: string;
  notes?: string;
}
