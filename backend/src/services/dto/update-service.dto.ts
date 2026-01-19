/**
 * DTO for updating service information
 * All fields are optional
 */
export class UpdateServiceDto {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  isActive?: boolean;
}
