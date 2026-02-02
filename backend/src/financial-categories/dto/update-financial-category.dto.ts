import { IsString, IsEnum, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class UpdateFinancialCategoryDto {
  @IsOptional()
  @IsString({ message: 'Nome deve ser uma string' })
  name?: string;

  @IsOptional()
  @IsEnum(TransactionType, { message: 'Tipo deve ser EXPENSE ou REVENUE' })
  type?: TransactionType;

  @IsOptional()
  @IsBoolean({ message: 'isActive deve ser um booleano' })
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'parentId deve ser um UUID válido' })
  parentId?: string;
}
