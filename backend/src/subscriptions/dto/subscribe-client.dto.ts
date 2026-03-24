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
