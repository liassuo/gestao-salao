import { IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator';

export class AddOrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @IsIn(['PRODUCT', 'SERVICE'])
  itemType: 'PRODUCT' | 'SERVICE';
}
