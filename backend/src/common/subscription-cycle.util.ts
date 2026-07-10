/**
 * Regra do DIA-ÂNCORA do vencimento (pedido do dono, 10/07/2026): o dia de
 * vencimento da assinatura não deve mudar quando o cliente paga com poucos dias
 * de atraso. Antes, toda renovação fazia `endDate = agora + 1 mês` — venceu dia 7,
 * pagou dia 10, o vencimento virava dia 10 (e ia deslizando a cada atraso).
 *
 * Regra implementada (todas as renovações passam por computeRenewalCycle):
 *  - Pagou ADIANTADO/EM DIA (endDate ainda no futuro, assinatura ATIVA): o ciclo
 *    novo começa no vencimento atual → endDate = vencimento + 1 mês. O startDate
 *    NÃO muda (o ciclo corrente ainda está rodando).
 *  - Pagou com ATÉ `graceDays` (7) dias de ATRASO: o ciclo novo começa no
 *    vencimento antigo → o DIA se mantém (venceu dia 7, pagou dia 10, próximo
 *    vencimento dia 7).
 *  - ATRASO MAIOR que a carência: o ciclo recomeça na data do pagamento — manter
 *    o dia antigo daria ao cliente menos de um mês pelo valor cheio.
 *  - 1ª ativação (isRenewal=false — nunca houve ciclo pago): ciclo começa no
 *    pagamento (comportamento histórico; o endDate "provisório" gravado na criação
 *    NÃO é âncora — reaproveitá-lo inflava o prazo, o antigo "bug do +2 meses").
 *
 * `startDate` retornado ≠ null deve ser gravado junto: avançar o início do ciclo a
 * cada renovação é o que impede um pagamento antigo de contar como "ciclo pago"
 * para sempre (isCurrentCyclePaid/subscriptionCycleFloorMs usam startDate como
 * piso). Retorna null quando o ciclo corrente segue valendo (renovação adiantada).
 *
 * `allowFutureAnchor`: só a renovação de assinatura ATIVA (webhook com ciclo já
 * pago / débito automático no cartão) pode ancorar num endDate FUTURO. Para
 * status não-ativos, endDate futuro é o valor provisório da criação — ancorar
 * nele daria mês grátis (+2 meses).
 */
export const RENEWAL_ANCHOR_GRACE_DAYS = 7;

export interface RenewalCycle {
  /** Novo início do ciclo; null = manter o startDate atual (ciclo corrente segue). */
  startDate: Date | null;
  /** Novo vencimento (sempre início do ciclo + 1 mês). */
  endDate: Date;
  /** true quando o dia foi preservado a partir do vencimento anterior. */
  anchored: boolean;
}

function addOneMonth(base: Date): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function computeRenewalCycle(opts: {
  /** Vencimento vigente ANTES desta renovação (endDate da linha). */
  prevEndDate?: string | Date | null;
  /** Instante do pagamento que dispara a renovação (default: agora). */
  refDate?: Date;
  /** true = já houve ciclo PAGO antes desta cobrança (é renovação, não 1ª ativação). */
  isRenewal: boolean;
  /** true = pode ancorar em endDate futuro (só renovação de assinatura ATIVA). */
  allowFutureAnchor?: boolean;
  graceDays?: number;
}): RenewalCycle {
  const refDate = opts.refDate ?? new Date();
  const graceDays = opts.graceDays ?? RENEWAL_ANCHOR_GRACE_DAYS;

  const prevMs = opts.prevEndDate ? new Date(opts.prevEndDate).getTime() : NaN;
  const prev = Number.isNaN(prevMs) ? null : new Date(prevMs);

  if (!opts.isRenewal || !prev) {
    return { startDate: refDate, endDate: addOneMonth(refDate), anchored: false };
  }

  if (prev.getTime() > refDate.getTime()) {
    if (opts.allowFutureAnchor) {
      // Renovação adiantada de assinatura ativa: acumula a partir do vencimento;
      // o ciclo corrente continua valendo (startDate intacto).
      return { startDate: null, endDate: addOneMonth(prev), anchored: true };
    }
    // endDate futuro em status não-ativo = provisório → ciclo começa no pagamento.
    return { startDate: refDate, endDate: addOneMonth(refDate), anchored: false };
  }

  const lateMs = refDate.getTime() - prev.getTime();
  if (lateMs <= graceDays * 24 * 60 * 60 * 1000) {
    // Atraso dentro da carência: mantém o dia do vencimento.
    return { startDate: prev, endDate: addOneMonth(prev), anchored: true };
  }

  return { startDate: refDate, endDate: addOneMonth(refDate), anchored: false };
}
