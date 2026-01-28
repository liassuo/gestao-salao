/**
 * DTO for creating a new subscription plan
 */
export class CreatePlanDto {
  name: string;
  description?: string;
  price: number; // Price in cents
  cutsPerMonth: number; // Number of cuts allowed per month
}
