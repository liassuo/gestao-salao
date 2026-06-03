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
 *
 * @param supabase  client/serviço com `.from()` (SupabaseService ou SupabaseClient)
 * @param select    colunas a selecionar (ex.: 'amount, method, asaasStatus')
 * @param startOfDay janela inicial inclusiva (YYYY-MM-DDT00:00:00)
 * @param endOfDay   janela final inclusiva (YYYY-MM-DDT23:59:59) — opcional; omita
 *                   para janela aberta (do start até o presente, ex.: receita do mês).
 */
export async function fetchPaymentsByBusinessDate(
  supabase: { from: (t: string) => any },
  select: string,
  startOfDay: string,
  endOfDay?: string,
): Promise<any[]> {
  let qBusiness = supabase
    .from('payments')
    .select(select)
    .gte('businessDate', startOfDay);
  if (endOfDay) qBusiness = qBusiness.lte('businessDate', endOfDay);

  let qLegacy = supabase
    .from('payments')
    .select(select)
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

  return [...(byBusiness || []), ...(byPaidLegacy || [])];
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
