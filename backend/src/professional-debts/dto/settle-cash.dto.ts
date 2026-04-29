import { IsOptional, IsString, IsIn, IsInt, IsPositive } from 'class-validator';

export class SettleCashDto {
  /** Se omitido, quita o saldo total restante */
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsIn(['CASH', 'PIX', 'CARD'])
  method?: 'CASH' | 'PIX' | 'CARD';

  @IsOptional()
  @IsString()
  registeredBy?: string;
}
