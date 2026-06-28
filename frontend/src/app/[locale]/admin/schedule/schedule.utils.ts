export const SCHEDULE_INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The session form keeps start/end as combined `yyyy-MM-ddTHH:mm` strings, but
// the UI splits them into a calendar date picker (event-creation style) + a
// time field. These helpers convert between the two representations.
export function splitDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const [date = '', time = ''] = value.split('T');
  return { date, time };
}

export function combineDateTime(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}
