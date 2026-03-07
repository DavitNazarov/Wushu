export const ROLES = {
  admin: 'admin',
  coach: 'coach',
  athlete: 'athlete',
  judge: 'judge',
  timekeeper: 'timekeeper',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const CAPABILITIES = {
  EVENTS_MANAGE: 'EVENTS_MANAGE',
  RULESETS_MANAGE: 'RULESETS_MANAGE',
  ATHLETES_MANAGE: 'ATHLETES_MANAGE',
  WEIGHIN_RUN: 'WEIGHIN_RUN',
  DRAW_RUN: 'DRAW_RUN',
  SCHEDULE_MANAGE: 'SCHEDULE_MANAGE',
  LIVE_RUN: 'LIVE_RUN',
  RESULTS_MANAGE: 'RESULTS_MANAGE',
  EXPORTS_MANAGE: 'EXPORTS_MANAGE',
  CONTENT_MANAGE: 'CONTENT_MANAGE',
} as const;

export type CapabilityCode = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

const ADMIN_CAPABILITIES: CapabilityCode[] = [
  CAPABILITIES.EVENTS_MANAGE,
  CAPABILITIES.RULESETS_MANAGE,
  CAPABILITIES.ATHLETES_MANAGE,
  CAPABILITIES.WEIGHIN_RUN,
  CAPABILITIES.DRAW_RUN,
  CAPABILITIES.SCHEDULE_MANAGE,
  CAPABILITIES.LIVE_RUN,
  CAPABILITIES.RESULTS_MANAGE,
  CAPABILITIES.EXPORTS_MANAGE,
  CAPABILITIES.CONTENT_MANAGE,
];

const COACH_CAPABILITIES: CapabilityCode[] = [CAPABILITIES.ATHLETES_MANAGE];

const JUDGE_CAPABILITIES: CapabilityCode[] = [CAPABILITIES.LIVE_RUN];

const TIMEKEEPER_CAPABILITIES: CapabilityCode[] = [CAPABILITIES.LIVE_RUN];

export function getCapabilitiesForRole(role: UserRole): string[] {
  if (role === 'admin') return [...ADMIN_CAPABILITIES];
  if (role === 'coach') return [...COACH_CAPABILITIES];
  if (role === 'judge') return [...JUDGE_CAPABILITIES];
  if (role === 'timekeeper') return [...TIMEKEEPER_CAPABILITIES];
  return [];
}
