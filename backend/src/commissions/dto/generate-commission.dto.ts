import { IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateCommissionDto {
  @IsDateString({}, { message: 'Data de início deve ser uma data válida' })
  periodStart: string;

  @IsDateString({}, { message: 'Data de fim deve ser uma data válida' })
  periodEnd: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
