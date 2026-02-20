import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentCondition, PaymentMethodScope } from '../../common/enums';

/**
 * DTO for creating a new payment method configuration
 */
export class CreatePaymentMethodConfigDto {
  @IsString({ message: 'Nome deve ser uma string' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsEnum(PaymentCondition, { message: 'Tipo deve ser A_VISTA ou A_PRAZO' })
  type: PaymentCondition;

  @IsEnum(PaymentMethodScope, {
    message: 'Escopo deve ser COMANDA, EXPENSE ou BOTH',
  })
  scope: PaymentMethodScope;
}
