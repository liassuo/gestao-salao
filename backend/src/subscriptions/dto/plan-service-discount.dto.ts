import { IsString, IsNumber, Min, Max } from 'class-validator';

export class PlanServiceDiscountDto {
  @IsString()
  serviceId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;
}
