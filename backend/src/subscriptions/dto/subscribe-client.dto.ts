import { IsString, IsOptional, IsIn } from 'class-validator';

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
}
