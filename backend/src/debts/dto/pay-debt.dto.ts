import { IsInt, IsPositive, IsOptional, IsString, IsUUID } from 'class-validator';

export class PayDebtDto {
  @IsInt({ message: 'Valor deve ser um número inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @IsOptional()
  @IsUUID()
  registeredBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
