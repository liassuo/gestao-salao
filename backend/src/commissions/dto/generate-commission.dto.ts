import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateCommissionDto {
  @IsDateString({}, { message: 'Data de início deve ser uma data válida' })
  periodStart: string;

  @IsDateString({}, { message: 'Data de fim deve ser uma data válida' })
  periodEnd: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  // Faturamento de assinaturas em centavos. Quando informado, sobrescreve o
  // valor auto-calculado a partir das assinaturas ativas no período.
  @IsOptional()
  @IsInt()
  @Min(0)
  subscriptionRevenueOverride?: number;

  // Quando true, apaga comissoes PENDING que se sobrepoem ao periodo antes de
  // gerar. Usado pelo frontend depois que o usuario confirma no dialogo.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
