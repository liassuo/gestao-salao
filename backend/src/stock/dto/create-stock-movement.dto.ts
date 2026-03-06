import { IsString, IsOptional, IsNumber, IsIn, Min } from 'class-validator';

export class CreateStockMovementDto {
  @IsString()
  productId: string;

  @IsString()
  @IsIn(['ENTRY', 'EXIT'])
  type: 'ENTRY' | 'EXIT';

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
