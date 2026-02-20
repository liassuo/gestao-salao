import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class UpdatePaymentDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
