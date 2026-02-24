import { IsOptional, IsString } from 'class-validator';

export class QueryOrderDto {
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'PAID' | 'CANCELED';

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}
