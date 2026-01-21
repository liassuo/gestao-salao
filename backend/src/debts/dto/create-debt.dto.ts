import {
  IsUUID,
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class CreateDebtDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsInt({ message: 'Valor deve ser um número inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}
