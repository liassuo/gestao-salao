import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for creating a new branch (filial)
 */
export class CreateBranchDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
