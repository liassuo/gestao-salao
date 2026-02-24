import { IsOptional, IsString } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  all?: string; // 'true' to include inactive

  @IsOptional()
  @IsString()
  search?: string;
}
