import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class RateAppointmentDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
