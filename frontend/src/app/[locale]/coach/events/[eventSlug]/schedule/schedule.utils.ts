import type { ScheduleFightRow } from '@/types/api';

export function groupByMat(
  fights: ScheduleFightRow[],
  unassignedLabel: string,
): { mats: string[]; byMat: Record<string, ScheduleFightRow[]> } {
  const byMat = fights.reduce<Record<string, ScheduleFightRow[]>>((acc, f) => {
    const mat = f.matName ?? unassignedLabel;
    if (!acc[mat]) acc[mat] = [];
    acc[mat].push(f);
    return acc;
  }, {});
  return { mats: Object.keys(byMat).sort(), byMat };
}
