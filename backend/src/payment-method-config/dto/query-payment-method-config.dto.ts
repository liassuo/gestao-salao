import { IsOptional, IsEnum, IsBooleanString } from 'class-validator';
import { PaymentCondition, PaymentMethodScope } from '@prisma/client';

/**
 * DTO for querying payment method configurations
 * All fields are optional filters
 */
export class QueryPaymentMethodConfigDto {
  @IsOptional()
  @IsEnum(PaymentMethodScope, {
    message: 'Escopo deve ser COMANDA, EXPENSE ou BOTH',
  })
  scope?: PaymentMethodScope;

  @IsOptional()
  @IsEnum(PaymentCondition, { message: 'Tipo deve ser A_VISTA ou A_PRAZO' })
  type?: PaymentCondition;

  @IsOptional()
  @IsBooleanString({ message: 'isActive deve ser "true" ou "false"' })
  isActive?: string;
}
