import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(60)
  slotDuration?: number;
}
