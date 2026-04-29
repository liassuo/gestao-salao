import { IsOptional, IsUUID, IsIn } from 'class-validator';
import type { ProfessionalDebtStatus } from '../entities/professional-debt.entity';

export class QueryProfessionalDebtDto {
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'DEDUCTED', 'SETTLED_CASH', 'VOIDED'])
  status?: ProfessionalDebtStatus;
}
