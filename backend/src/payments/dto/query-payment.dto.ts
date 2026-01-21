import { IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class QueryPaymentDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
