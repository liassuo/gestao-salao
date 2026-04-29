import { IsOptional, IsString, IsIn, IsDateString, IsBoolean } from 'class-validator';
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

  @ApiPropertyOptional({
    description:
      'Se true, lança a comanda como débito do profissional consumidor (não entra no caixa). ' +
      'Requer que a comanda tenha consumerType=PROFESSIONAL ou consumerProfessionalId informado aqui.',
  })
  @IsOptional()
  @IsBoolean()
  asProfessionalDebt?: boolean;

  @ApiPropertyOptional({
    description:
      'Profissional consumidor (sobrescreve consumerProfessionalId da comanda). Usado com asProfessionalDebt=true.',
  })
  @IsOptional()
  @IsString()
  consumerProfessionalId?: string;
}
