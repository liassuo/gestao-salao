/**
 * Formata preço de centavos para BRL
 */
export function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Parse seguro de data.
 *
 * Por que existir: o backend grava `scheduledAt` (e similares) como string local
 * `YYYY-MM-DDTHH:mm:ss`, mas a coluna no Postgres é `timestamptz`, então o
 * Supabase devolve com sufixo `Z`/`+00:00`. Se passarmos isso direto para
 * `new Date(...)`, o JS reinterpreta como UTC e desloca pelo fuso do
 * navegador (ex.: 18:00 vira 15:00 em BRT) — derruba filtros de "próximos
 * agendamentos" e mostra horário errado no card.
 *
 * Strings `YYYY-MM-DD` puras recebem `T12:00:00` para não cair no dia anterior
 * em fusos negativos.
 */
export function safeParseDate(dateStr: string): Date {
  const clean = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(clean + 'T12:00:00');
  }
  return new Date(clean);
}

/**
 * Formata data ISO para exibicao curta
 */
export function formatDate(isoDate: string): string {
  const date = safeParseDate(isoDate);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Formata data ISO para exibicao completa
 */
export function formatDateLong(isoDate: string): string {
  const date = safeParseDate(isoDate);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formata hora de data ISO
 */
export function formatTime(isoDate: string): string {
  const date = safeParseDate(isoDate);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calcula hora de término baseado em duração
 */
export function formatEndTime(isoDate: string, durationMinutes: number): string {
  const date = safeParseDate(isoDate);
  date.setMinutes(date.getMinutes() + durationMinutes);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata data para ISO (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formata data para dia da semana curto
 */
export function formatWeekday(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' });
}

/**
 * Formata data para dia/mes curto
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Verifica se uma data esta no passado
 */
export function isPastDate(isoDate: string): boolean {
  return safeParseDate(isoDate) < new Date();
}

/**
 * Calcula horas ate um agendamento
 */
export function hoursUntil(isoDate: string): number {
  const now = new Date();
  const target = safeParseDate(isoDate);
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Formata duração em minutos para texto
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}
