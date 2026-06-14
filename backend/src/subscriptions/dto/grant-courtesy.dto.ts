import { IsString, IsDateString, IsOptional, IsIn } from 'class-validator';

/**
 * Concessão de assinatura pelo admin. O cliente "ganha" o plano até `endDate`
 * (limite de 1 mês — validado no service).
 *
 * - SEM `paymentMethod`: cortesia grátis (sem pagamento/caixa/dívida).
 * - COM `paymentMethod`: a 1ª mensalidade é contabilizada no caixa (entra como
 *   receita pelo método informado) e a assinatura passa a se comportar como uma
 *   assinatura paga normal (inadimplência ao vencer). As renovações seguintes já
 *   são pagas/contabilizadas pelo fluxo de renovação existente.
 */
export class GrantCourtesyDto {
  @IsString()
  clientId: string;

  @IsString()
  planId: string;

  /** Dia de término (ISO). Deve ser futuro e no máximo hoje + 1 mês. */
  @IsDateString()
  endDate: string;

  /** Se presente, contabiliza a 1ª mensalidade no caixa pelo método informado. */
  @IsOptional()
  @IsIn(['CASH', 'PIX', 'CARD'])
  paymentMethod?: 'CASH' | 'PIX' | 'CARD';
}
