import { IsIn, IsOptional } from 'class-validator';

export class ReactivateMeDto {
  @IsOptional()
  @IsIn(['PIX', 'CREDIT_CARD'])
  billingType?: 'PIX' | 'CREDIT_CARD';
}
