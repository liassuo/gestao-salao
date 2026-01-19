/**
 * DTO for creating a new service
 */
export class CreateServiceDto {
  name: string;
  description?: string;
  price: number; // Price in cents
  duration: number; // Duration in minutes
}
