import type { ScheduleFight } from '@/lib/api/public';

export type GroupedScheduleFights = {
  label: string;
  fights: ScheduleFight[];
}[];

export function groupScheduleFightsByDate(input: {
  fights: ScheduleFight[];
  locale: string;
  unscheduledLabel: string;
}): GroupedScheduleFights {
  const grouped = new Map<string, ScheduleFight[]>();

  for (const fight of input.fights) {
    const label = fight.scheduledAt
      ? new Date(fight.scheduledAt).toLocaleDateString(input.locale)
      : input.unscheduledLabel;
    const bucket = grouped.get(label) ?? [];
    bucket.push(fight);
    grouped.set(label, bucket);
  }

  return [...grouped.entries()].map(([label, fights]) => ({
    label,
    fights,
  }));
}
