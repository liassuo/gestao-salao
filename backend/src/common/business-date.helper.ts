/**
 * Status Asaas que tiram o pagamento da RECEITA: estorno/cancelamento/deleção e
 * chargeback. Um pagamento nesses estados não é dinheiro que entrou — não pode
 * contar no caixa, no dashboard nem nos relatórios. (REFUND_REQUESTED/
 * REFUND_IN_PROGRESS já entram aqui porque o dinheiro está saindo: assim que o
 * dono dispara o estorno, o valor some da receita, sem esperar o REFUNDED final.)
 */
export const NON_REVENUE_ASAAS_STATUSES = [
  'REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS',
  'DELETED',
  'CANCELED',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
] as const;

/**
 * True se o pagamento conta como receita. Pagamentos manuais (sem asaasStatus)
 * sempre contam; pagamentos Asaas só não contam quando estornados/cancelados.
 * Fonte única de verdade — use em TODA leitura de receita (caixa, dashboard,
 * relatórios, comissões) para um pagamento estornado nunca virar "dinheiro
 * fantasma" em nenhuma tela.
 *
 * `excludedFromCashAt` é a exclusão LOCAL: pagamento real (dinheiro entrou,
 * não estornado) que não deve contar como receita — ex.: pré-pago de
 * agendamento cancelado/no-show. Não dá para usar asaasStatus para isso (é
 * espelho do gateway; a reconciliação sobrescreveria) nem limpar businessDate
 * (a perna legada do fetch recontaria pelo paidAt).
 */
export function isRevenuePayment(p: {
  asaasStatus?: string | null;
  excludedFromCashAt?: string | null;
}): boolean {
  if (p.excludedFromCashAt) return false;
  return !(
    p.asaasStatus &&
    (NON_REVENUE_ASAAS_STATUSES as readonly string[]).includes(p.asaasStatus)
  );
}

/**
 * Busca pagamentos por DIA CONTÁBIL (businessDate), com coalesce para o paidAt
 * dos registros legados (businessDate nulo).
 *
 * Por que existe: caixa, dashboard e relatórios passaram a contabilizar pela data
 * do atendimento (payments.businessDate) em vez da data do pagamento (paidAt).
 * O Postgres/Supabase não expõe coalesce direto no filtro, então combinamos:
 *   (a) businessDate dentro da janela [start, end]  → regra nova;
 *   (b) businessDate NULL e paidAt na janela          → histórico (conta como antes).
 *
 * Cobranças pendentes (paidAt e businessDate nulos) não entram em nenhuma das duas
 * — só passam a contar quando o pagamento é confirmado e os campos preenchidos.
 * A perna (a) ainda exige paidAt preenchido: um registro com businessDate mas SEM
 * paidAt é cobrança NÃO paga (ex.: espelho de recorrência vencida) — dinheiro que
 * não entrou não pode virar receita.
 *
 * Estornados/cancelados (asaasStatus em NON_REVENUE_ASAAS_STATUSES) são REMOVIDOS
 * por padrão — o `asaasStatus` é sempre incluído no select internamente, então o
 * filtro funciona mesmo que o chamador não tenha pedido essa coluna. Passe
 * `{ includeNonRevenue: true }` só quando quiser a lista bruta (ex.: auditoria).
 *
 * @param supabase  client/serviço com `.from()` (SupabaseService ou SupabaseClient)
 * @param select    colunas a selecionar (ex.: 'amount, method')
 * @param startOfDay janela inicial inclusiva (YYYY-MM-DDT00:00:00)
 * @param endOfDay   janela final — inclusiva por padrão (YYYY-MM-DDT23:59:59);
 *                   opcional; omita para janela aberta (do start até o presente).
 * @param opts.includeNonRevenue  não filtrar estornos (default: false → filtra).
 * @param opts.endExclusive  trata endOfDay como limite EXCLUSIVO (passe o início
 *                   do dia seguinte, ex.: 'YYYY-MM-DDT00:00:00'). Preferível para
 *                   janelas de um dia: .lte('...T23:59:59') perde timestamp com
 *                   milissegundos ('...T23:59:59.123' ordena depois lexicograficamente).
 */
export async function fetchPaymentsByBusinessDate(
  supabase: { from: (t: string) => any },
  select: string,
  startOfDay: string,
  endOfDay?: string,
  opts: { includeNonRevenue?: boolean; endExclusive?: boolean } = {},
): Promise<any[]> {
  // Garante as colunas do filtro de receita (asaasStatus, excludedFromCashAt)
  // no select, sem o chamador precisar lembrar de pedir. Se for '*', já vem tudo.
  let effectiveSelect = select;
  if (select.trim() !== '*') {
    if (!/(^|[,\s])asaasStatus($|[,\s])/.test(effectiveSelect)) {
      effectiveSelect += ', asaasStatus';
    }
    if (!/(^|[,\s])excludedFromCashAt($|[,\s])/.test(effectiveSelect)) {
      effectiveSelect += ', excludedFromCashAt';
    }
  }

  let qBusiness = supabase
    .from('payments')
    .select(effectiveSelect)
    .not('paidAt', 'is', null)
    .gte('businessDate', startOfDay);
  if (endOfDay) {
    qBusiness = opts.endExclusive
      ? qBusiness.lt('businessDate', endOfDay)
      : qBusiness.lte('businessDate', endOfDay);
  }

  let qLegacy = supabase
    .from('payments')
    .select(effectiveSelect)
    .is('businessDate', null)
    .gte('paidAt', startOfDay);
  if (endOfDay) {
    qLegacy = opts.endExclusive
      ? qLegacy.lt('paidAt', endOfDay)
      : qLegacy.lte('paidAt', endOfDay);
  }

  const [{ data: byBusiness, error: bErr }, { data: byPaidLegacy, error: pErr }] =
    await Promise.all([qBusiness, qLegacy]);

  const error = bErr || pErr;
  if (error) {
    throw new Error(
      `Falha ao buscar pagamentos por businessDate [${startOfDay}..${endOfDay ?? '∞'}]: ${error.message} (code=${error.code})`,
    );
  }

  const all = [...(byBusiness || []), ...(byPaidLegacy || [])];
  return opts.includeNonRevenue ? all : all.filter(isRevenuePayment);
}

/**
 * Retorna o dia contábil (YYYY-MM-DD) de um pagamento para agrupamento:
 * businessDate quando presente, senão paidAt. Use ao agregar por dia/mês.
 */
export function paymentBusinessDay(p: {
  businessDate?: string | null;
  paidAt?: string | null;
}): string {
  return String(p.businessDate ?? p.paidAt ?? '').substring(0, 10);
}
