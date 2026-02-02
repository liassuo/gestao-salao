import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { PaymentCondition, PaymentMethodScope } from '@prisma/client';

/**
 * DTO for updating a payment method configuration
 * All fields are optional
 */
export class UpdatePaymentMethodConfigDto {
  @IsOptional()
  @IsString({ message: 'Nome deve ser uma string' })
  name?: string;

  @IsOptional()
  @IsEnum(PaymentCondition, { message: 'Tipo deve ser A_VISTA ou A_PRAZO' })
  type?: PaymentCondition;

  @IsOptional()
  @IsEnum(PaymentMethodScope, {
    message: 'Escopo deve ser COMANDA, EXPENSE ou BOTH',
  })
  scope?: PaymentMethodScope;

  @IsOptional()
  @IsBoolean({ message: 'isActive deve ser um booleano' })
  isActive?: boolean;
}
