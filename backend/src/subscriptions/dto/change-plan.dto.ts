import { IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreditCardDto, CreditCardHolderInfoDto } from './credit-card.dto';

/**
 * Troca de plano. Comportamento:
 *  - Upgrade (preco do novo > do atual): troca imediata, gera cobranca nova do
 *    plano novo, reseta o ciclo. Aceita os mesmos campos de SubscribeMe para o
 *    metodo de pagamento (PIX por default).
 *  - Downgrade ou lateral (preco <=): agenda a troca para a proxima renovacao
 *    via pendingPlanId. Nao gera cobranca nova nem mexe no ciclo atual.
 */
export class ChangePlanDto {
  @IsUUID()
  newPlanId: string;

  @IsOptional()
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType?: 'PIX' | 'CREDIT_CARD';

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;

  @IsOptional()
  @IsString()
  remoteIp?: string;
}
