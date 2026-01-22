/**
 * Formata valor em centavos para moeda brasileira (R$)
 * @param cents - Valor em centavos (ex: 6500 = R$ 65,00)
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Formata data para exibição no formato brasileiro
 * @param date - Data como string ISO ou Date
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Formata data e hora para exibição
 * @param date - Data como string ISO ou Date
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Formata hora para exibição
 * @param date - Data como string ISO ou Date
 */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Converte valor em reais (input do usuário) para centavos
 * @param reais - Valor em reais (ex: 65.00)
 */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Converte centavos para reais
 * @param cents - Valor em centavos (ex: 6500)
 */
export function centsToReais(cents: number): number {
  return cents / 100;
}
