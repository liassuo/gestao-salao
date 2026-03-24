import { IsInt, IsPositive, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';

export class PayDebtDto {
  @IsInt({ message: 'Valor deve ser um número inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @IsOptional()
  @IsIn(['CASH', 'PIX', 'CARD'])
  method?: string;

  @IsOptional()
  @IsUUID()
  registeredBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
