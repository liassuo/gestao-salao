import { IsUUID, IsInt, Min, IsOptional, IsString } from 'class-validator';

export class CloseCashRegisterDto {
  @IsInt({ message: 'Saldo de fechamento deve ser um número inteiro (centavos)' })
  @Min(0, { message: 'Saldo de fechamento não pode ser negativo' })
  closingBalance: number;

  @IsUUID()
  closedBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
