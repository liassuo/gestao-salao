import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PayOrderDto {
  @ApiPropertyOptional({ description: 'Método de pagamento manual' })
  @IsOptional()
  @IsIn(['CASH', 'PIX', 'CARD'])
  paymentMethod?: 'CASH' | 'PIX' | 'CARD';

  @ApiPropertyOptional({ description: 'ID do usuário que registra' })
  @IsOptional()
  @IsString()
  registeredBy?: string;

  @ApiPropertyOptional({
    description: 'Tipo de cobrança Asaas (PIX ou CREDIT_CARD). Se informado, gera cobrança digital ao invés de pagamento manual.',
    example: 'PIX',
  })
  @IsOptional()
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType?: 'PIX' | 'CREDIT_CARD';

  @ApiPropertyOptional({
    description: 'Data de vencimento para cobrança Asaas (YYYY-MM-DD)',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
