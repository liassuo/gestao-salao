import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateFinancialCategoryDto {
  @IsString({ message: 'Nome deve ser uma string' })
  name: string;

  @IsEnum(TransactionType, { message: 'Tipo deve ser EXPENSE ou REVENUE' })
  type: TransactionType;

  @IsOptional()
  @IsUUID('4', { message: 'parentId deve ser um UUID válido' })
  parentId?: string;
}
