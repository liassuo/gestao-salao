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
 * Converte string de data para Date tratando timezone corretamente
 */
function safeParseDate(date: string | Date): Date | null {
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  if (!date) return null;
  const clean = String(date).replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  // Strings "YYYY-MM-DD" sem hora são interpretadas como UTC pelo JS,
  // causando dia errado em fusos negativos. Adiciona T12:00:00 para forçar local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(clean + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata data para exibição no formato brasileiro
 * @param date - Data como string ISO ou Date
 */
export function formatDate(date: string | Date): string {
  const parsed = safeParseDate(date);
  if (!parsed) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

/**
 * Formata data e hora para exibição
 * @param date - Data como string ISO ou Date
 */
export function formatDateTime(date: string | Date): string {
  const parsed = safeParseDate(date);
  if (!parsed) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

/**
 * Formata hora para exibição
 * @param date - Data como string ISO ou Date
 */
export function formatTime(date: string | Date): string {
  const parsed = safeParseDate(date);
  if (!parsed) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

/**
 * Formata telefone para exibição: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * @param phone - Telefone como string (com ou sem formatação)
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

/**
 * Formata telefone durante digitação no input
 * @param value - Valor atual do input
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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
