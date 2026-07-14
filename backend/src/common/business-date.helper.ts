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
 */
export function isRevenuePayment(p: { asaasStatus?: string | null }): boolean {
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
 * @param endOfDay   janela final inclusiva (YYYY-MM-DDT23:59:59) — opcional; omita
 *                   para janela aberta (do start até o presente, ex.: receita do mês).
 * @param opts.includeNonRevenue  não filtrar estornos (default: false → filtra).
 */
export async function fetchPaymentsByBusinessDate(
  supabase: { from: (t: string) => any },
  select: string,
  startOfDay: string,
  endOfDay?: string,
  opts: { includeNonRevenue?: boolean } = {},
): Promise<any[]> {
  // Garante asaasStatus no select para o filtro de receita funcionar, sem o
  // chamador precisar lembrar de pedir. Se select for '*', já vem incluso.
  const effectiveSelect =
    select.trim() === '*' || /(^|[,\s])asaasStatus($|[,\s])/.test(select)
      ? select
      : `${select}, asaasStatus`;

  let qBusiness = supabase
    .from('payments')
    .select(effectiveSelect)
    .not('paidAt', 'is', null)
    .gte('businessDate', startOfDay);
  if (endOfDay) qBusiness = qBusiness.lte('businessDate', endOfDay);

  let qLegacy = supabase
    .from('payments')
    .select(effectiveSelect)
    .is('businessDate', null)
    .gte('paidAt', startOfDay);
  if (endOfDay) qLegacy = qLegacy.lte('paidAt', endOfDay);

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
