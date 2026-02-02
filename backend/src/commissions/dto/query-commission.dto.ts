import { IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { CommissionStatus } from '@prisma/client';

export class QueryCommissionDto {
  @IsOptional()
  @IsUUID('4', { message: 'professionalId deve ser um UUID válido' })
  professionalId?: string;

  @IsOptional()
  @IsEnum(CommissionStatus, { message: 'Status deve ser PENDING ou PAID' })
  status?: CommissionStatus;

  @IsOptional()
  @IsDateString({}, { message: 'Data de início deve ser uma data válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de fim deve ser uma data válida' })
  endDate?: string;
}
