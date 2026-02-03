import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateTimeBlockDto {
  @IsString()
  professionalId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
