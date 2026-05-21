import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Desconto manual em centavos. 0 = sem desconto. */
  @IsOptional()
  @IsInt()
  @Min(0)
  manualDiscount?: number;
}
