import { IsString, IsDateString } from 'class-validator';

/**
 * Concessão de assinatura CORTESIA (grátis) pelo admin. O cliente "ganha" o plano
 * até `endDate` (limite de 1 mês — validado no service). Sem pagamento, sem
 * cobrança, sem dívida.
 */
export class GrantCourtesyDto {
  @IsString()
  clientId: string;

  @IsString()
  planId: string;

  /** Dia de término da cortesia (ISO). Deve ser futuro e no máximo hoje + 1 mês. */
  @IsDateString()
  endDate: string;
}
