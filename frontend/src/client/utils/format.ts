/**
 * Formata preco de centavos para BRL
 */
export function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formata data ISO para exibicao curta
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
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
  const date = new Date(isoDate);
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
  const date = new Date(isoDate);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calcula hora de termino baseado em duracao
 */
export function formatEndTime(isoDate: string, durationMinutes: number): string {
  const date = new Date(isoDate);
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
  return date.toISOString().split('T')[0];
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
  return new Date(isoDate) < new Date();
}

/**
 * Calcula horas ate um agendamento
 */
export function hoursUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Formata duracao em minutos para texto
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
