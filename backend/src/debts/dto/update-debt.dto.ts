import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}
