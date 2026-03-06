import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cutsPerMonth?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
