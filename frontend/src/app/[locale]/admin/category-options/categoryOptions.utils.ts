/** Human-readable weight-division range, e.g. "> 60 – ≤ 65 kg", "≤ 24 kg", "> 56 kg". */
export function formatWeightRange(
  min: number | null,
  max: number | null,
): string {
  if (min == null && max == null) return '—';
  if (max == null) return `> ${min} kg`;
  if (min == null) return `≤ ${max} kg`;
  return `> ${min} – ≤ ${max} kg`;
}
