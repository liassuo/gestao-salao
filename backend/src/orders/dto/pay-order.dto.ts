import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PayOrderDto {
  @ApiPropertyOptional({ description: 'Método de pagamento manual' })
  @IsOptional()
  @IsString()
  paymentMethod?: 'CASH' | 'PIX' | 'CARD' | 'BOLETO';

  @ApiPropertyOptional({ description: 'ID do usuário que registra' })
  @IsOptional()
  @IsString()
  registeredBy?: string;

  @ApiPropertyOptional({
    description: 'Tipo de cobrança Asaas (PIX, BOLETO, CREDIT_CARD). Se informado, gera cobrança digital ao invés de pagamento manual.',
    example: 'PIX',
  })
  @IsOptional()
  @IsString()
  billingType?: 'PIX' | 'BOLETO' | 'CREDIT_CARD';

  @ApiPropertyOptional({
    description: 'Data de vencimento para cobrança Asaas (YYYY-MM-DD)',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
