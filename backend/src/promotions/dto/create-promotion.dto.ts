import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @IsOptional()
  @IsString()
  bannerTitle?: string;

  @IsOptional()
  @IsString()
  bannerText?: string;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}
