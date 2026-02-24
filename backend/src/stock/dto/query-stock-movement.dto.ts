import { IsOptional, IsString } from 'class-validator';

export class QueryStockMovementDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  type?: 'ENTRY' | 'EXIT';

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
