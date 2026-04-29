import { IsOptional, IsString, IsArray, IsNumber, IsIn, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
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

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** CLIENT (default) ou PROFESSIONAL (consumo do próprio profissional → vira débito) */
  @IsOptional()
  @IsIn(['CLIENT', 'PROFESSIONAL'])
  consumerType?: 'CLIENT' | 'PROFESSIONAL';

  /** Obrigatório quando consumerType = PROFESSIONAL */
  @IsOptional()
  @IsString()
  consumerProfessionalId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
