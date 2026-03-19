import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class OpenCashRegisterDto {
  @IsOptional()
  @IsDateString()
  date?: Date; // Se não informado, usa data atual

  @IsInt({ message: 'Saldo de abertura deve ser um número inteiro (centavos)' })
  @Min(0, { message: 'Saldo de abertura não pode ser negativo' })
  openingBalance: number;

  @IsOptional()
  @IsUUID()
  openedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
