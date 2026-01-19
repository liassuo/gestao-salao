/**
 * DTO for updating client information
 * All fields are optional
 */
export class UpdateClientDto {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  isActive?: boolean;
  notes?: string;
}
