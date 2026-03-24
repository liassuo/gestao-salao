import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class SubscribeMeDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType?: 'PIX' | 'CREDIT_CARD';
}
