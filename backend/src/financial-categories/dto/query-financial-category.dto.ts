import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { TransactionType } from '../../common/enums';

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
