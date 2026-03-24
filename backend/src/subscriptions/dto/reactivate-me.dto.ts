import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreditCardDto, CreditCardHolderInfoDto } from './credit-card.dto';

export class ReactivateMeDto {
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
