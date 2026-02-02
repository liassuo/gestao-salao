import { IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for updating bank account information
 * All fields are optional
 */
export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  accountType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
