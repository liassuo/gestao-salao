import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  totalDuration?: number;
}
