import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * DTO for creating a new bank account
 */
export class CreateBankAccountDto {
  @IsString({ message: 'Nome deve ser uma string' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Banco deve ser uma string' })
  bank?: string;

  @IsOptional()
  @IsString({ message: 'Tipo de conta deve ser uma string' })
  accountType?: string;
}
