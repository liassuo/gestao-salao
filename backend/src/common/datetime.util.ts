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
