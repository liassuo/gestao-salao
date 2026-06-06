import { IsString, IsOptional, IsIn, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { CreditCardDto, CreditCardHolderInfoDto } from './credit-card.dto';

export class SubscribeClientDto {
  @IsString()
  clientId: string;

  @IsString()
  planId: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType?: 'PIX' | 'CREDIT_CARD';

  /**
   * Pagamento recebido NO BALCÃO no ato da assinatura/renovação (admin já tem o
   * dinheiro na mão). Quando presente, a assinatura é ativada na hora e o
   * pagamento é lançado no caixa do dia — sem gerar cobrança Asaas/PIX. É o
   * fluxo "renovei e caiu no caixa de hoje" que o salão usa no dia a dia.
   * Ausente = fluxo online (gera cobrança Asaas, ativa só quando o cliente paga).
   */
  @IsOptional()
  @IsIn(['CASH', 'PIX', 'CARD'])
  paymentMethod?: 'CASH' | 'PIX' | 'CARD';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;

  @IsOptional()
  @IsString()
  remoteIp?: string;
}
