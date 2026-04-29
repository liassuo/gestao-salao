import {
  IsUUID,
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Lançamento manual de débito do profissional (sem comanda).
 * Ex.: vale-adiantamento, ferramenta perdida, multa.
 *
 * Para débitos vindos de comanda, usar o fluxo /orders/:id/pay com
 * consumerType=PROFESSIONAL — não chamar este endpoint.
 */
export class CreateProfessionalDebtDto {
  @IsUUID()
  professionalId: string;

  @IsInt({ message: 'Valor deve ser um número inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
