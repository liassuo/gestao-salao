import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
