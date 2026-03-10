export function formatDateTime(value: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}
