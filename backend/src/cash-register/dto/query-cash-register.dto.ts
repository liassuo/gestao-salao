import { IsOptional, IsDateString } from 'class-validator';

export class QueryCashRegisterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
