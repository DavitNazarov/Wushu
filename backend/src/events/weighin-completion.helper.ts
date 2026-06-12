import type { WeighInStatus } from '@prisma/client';

const FINAL_WEIGH_IN_STATUSES: ReadonlySet<WeighInStatus> = new Set([
  'PASSED',
  'MOVED_UP',
  'FAILED',
  'OVERRIDE_APPROVED',
  'DISQUALIFIED',
]);

export function isFinalWeighInStatus(
  status: WeighInStatus | null | undefined,
): boolean {
  if (!status) return false;
  return FINAL_WEIGH_IN_STATUSES.has(status);
}

export function isWeighInComplete(
  statuses: Array<WeighInStatus | null | undefined>,
): boolean {
  if (statuses.length === 0) return false;
  return statuses.every((status) => isFinalWeighInStatus(status));
}
