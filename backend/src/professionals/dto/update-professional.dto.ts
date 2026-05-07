import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, ValidateIf, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class RecurringBreakDto {
  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class WorkingHoursDto {
  @IsNumber()
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringBreakDto)
  breaks?: RecurringBreakDto[];
}

export class UpdateProfessionalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @ValidateIf((o) => o.avatarUrl !== null && o.avatarUrl !== undefined)
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDto)
  workingHours?: WorkingHoursDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
