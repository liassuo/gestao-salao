import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
