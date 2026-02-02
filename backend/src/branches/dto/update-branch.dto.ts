import { IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for updating branch information
 * All fields are optional
 */
export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
