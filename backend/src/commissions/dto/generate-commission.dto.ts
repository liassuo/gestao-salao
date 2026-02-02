import { IsDateString } from 'class-validator';

export class GenerateCommissionDto {
  @IsDateString({}, { message: 'Data de início deve ser uma data válida' })
  startDate: string;

  @IsDateString({}, { message: 'Data de fim deve ser uma data válida' })
  endDate: string;
}
