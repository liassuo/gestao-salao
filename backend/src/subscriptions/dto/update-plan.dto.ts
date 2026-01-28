/**
 * DTO for updating an existing subscription plan
 */
export class UpdatePlanDto {
  name?: string;
  description?: string;
  price?: number;
  cutsPerMonth?: number;
  isActive?: boolean;
}
