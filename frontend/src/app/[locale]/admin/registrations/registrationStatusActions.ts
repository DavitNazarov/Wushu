'use client';

import type { RegistrationRow, RegistrationStatus } from '@/types/api';

export type RowAction = 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

const ELIGIBLE_STATUS_MAP: Record<RowAction, RegistrationStatus[]> = {
  APPROVED: ['PENDING', 'SUBMITTED', 'REJECTED'],
  REJECTED: ['PENDING', 'SUBMITTED', 'APPROVED'],
  WITHDRAWN: ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'],
};

export function canApplyRegistrationAction(
  action: RowAction,
  status: RegistrationStatus,
): boolean {
  return ELIGIBLE_STATUS_MAP[action].includes(status);
}

export function getEligibleRegistrationIds(
  rows: RegistrationRow[],
  action: RowAction,
): string[] {
  return rows
    .filter((row) => canApplyRegistrationAction(action, row.status))
    .map((row) => row.id);
}
