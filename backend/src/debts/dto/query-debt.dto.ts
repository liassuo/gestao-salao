import { IsOptional, IsUUID, IsBooleanString } from 'class-validator';

export class QueryDebtDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsBooleanString()
  isSettled?: string; // 'true' ou 'false' (query params são strings)
}
