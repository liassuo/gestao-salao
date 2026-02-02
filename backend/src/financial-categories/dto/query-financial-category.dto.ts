import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class QueryFinancialCategoryDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  isActive?: string;
}
