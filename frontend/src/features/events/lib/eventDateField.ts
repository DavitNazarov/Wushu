export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateBadge(value: string, locale: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return 'dd.mm.yyyy';
  return parsed.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateMeta(value: string, locale: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function startOfCalendarGrid(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const day = start.getDay();
  const result = new Date(start);
  result.setDate(start.getDate() - day);
  return result;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
