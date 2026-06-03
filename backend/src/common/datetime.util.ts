/**
 * Utilitários de data/hora.
 *
 * Por que existir: a tabela `cash_registers.date` é gravada como string local
 * `YYYY-MM-DDT00:00:00` (sem timezone), e `calculateDailyTotals` filtra
 * `payments.paidAt` por janela de string local também. Se gravarmos `paidAt`
 * com `new Date().toISOString()` (UTC), em servidor não-UTC um pagamento feito
 * perto da meia-noite local cai em janela errada do caixa.
 *
 * Use `nowLocalIsoString()` em vez de `new Date().toISOString()` para qualquer
 * timestamp que seja comparado com `cash_registers.date` ou `paidAt`.
 */
export function nowLocalIsoString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}`
  );
}

/** Apenas a parte da data local (YYYY-MM-DD) */
export function localDateString(date: Date = new Date()): string {
  return nowLocalIsoString(date).substring(0, 10);
}

/**
 * Resolve a "data contábil" (businessDate) de um pagamento.
 *
 * Regra: a venda pertence ao DIA DO ATENDIMENTO. Quando há um agendamento
 * vinculado, usamos a data do `scheduledAt` (normalizada para meia-noite local,
 * `YYYY-MM-DDT00:00:00`), de modo que um pagamento lançado em outro dia (ex.:
 * 00:14 da madrugada seguinte) ainda contabilize no caixa do dia do atendimento.
 * Sem agendamento (balcão/avulso/assinatura), cai no `paidAt` informado.
 *
 * Aceita strings locais ("YYYY-MM-DD..." ou com sufixo Z/offset) ou Date.
 * Retorna `YYYY-MM-DDT00:00:00` quando deriva de scheduledAt, ou o próprio
 * `paidAtFallback` quando não há agendamento.
 */
export function resolveBusinessDate(
  scheduledAt: string | Date | null | undefined,
  paidAtFallback: string,
): string {
  // businessDate é TEXT e é comparado LEXICOGRAFICAMENTE nas janelas do caixa
  // (.gte('YYYY-MM-DDT00:00:00').lte('YYYY-MM-DDT23:59:59')). Por isso todo valor
  // gravado precisa estar no formato canônico de 19 chars "YYYY-MM-DDTHH:MM:SS",
  // sem sufixo Z/offset e sem milissegundos — senão o filtro do dia falha e a
  // receita "some" do caixa/dashboard/relatórios.
  if (scheduledAt) {
    const d = canonicalLocalDateTime(scheduledAt);
    // Atendimento define o DIA contábil: zera a hora.
    if (d) return `${d.substring(0, 10)}T00:00:00`;
  }
  const fb = canonicalLocalDateTime(paidAtFallback);
  if (fb) return fb;
  // Último recurso (fallback inválido): usa o agora local canônico.
  return nowLocalIsoString().substring(0, 19);
}

/**
 * Normaliza um valor de data/hora para o ISO LOCAL canônico de 19 chars
 * "YYYY-MM-DDTHH:MM:SS" (sem Z/offset/ms). Retorna null se não for parseável.
 *
 * - Data pura "YYYY-MM-DD"  → "YYYY-MM-DDT00:00:00" (NÃO usa new Date, que
 *   interpretaria como UTC e deslocaria o dia em fuso negativo).
 * - Datetime local sem tz (com/sem ms) → trunca para 19 chars (mantém wall-clock).
 * - Com Z/offset → converte para hora LOCAL do servidor e reemite sem ms
 *   (um instante UTC perto da meia-noite pertence ao dia local correto).
 */
function canonicalLocalDateTime(value: string | Date): string | null {
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00`;
  const localNoTz = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (localNoTz && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return localNoTz[1];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return nowLocalIsoString(d).substring(0, 19);
  const day = s.substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T00:00:00` : null;
}
