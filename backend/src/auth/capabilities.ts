export const ROLES = {
  admin: 'admin',
  coach: 'coach',
  athlete: 'athlete',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const CAPABILITIES = {
  EVENTS_VIEW_PUBLIC: 'events:view_public',
  EVENTS_MANAGE: 'events:manage',
  ATHLETES_MANAGE: 'athletes:manage',
  WEIGHIN_RECORD: 'weighin:record',
  BRACKETS_PUBLISH: 'brackets:publish',
  SCORING_OPERATE: 'scoring:operate',
  CAN_MANAGE_EVENT: 'CAN_MANAGE_EVENT',
  CAN_MANAGE_RULESETS: 'CAN_MANAGE_RULESETS',
} as const;

export type CapabilityCode = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

const ADMIN_CAPABILITIES: CapabilityCode[] = [
  CAPABILITIES.EVENTS_VIEW_PUBLIC,
  CAPABILITIES.EVENTS_MANAGE,
  CAPABILITIES.ATHLETES_MANAGE,
  CAPABILITIES.WEIGHIN_RECORD,
  CAPABILITIES.BRACKETS_PUBLISH,
  CAPABILITIES.SCORING_OPERATE,
  CAPABILITIES.CAN_MANAGE_EVENT,
  CAPABILITIES.CAN_MANAGE_RULESETS,
];

export function getCapabilitiesForRole(role: UserRole): string[] {
  if (role === 'admin') return [...ADMIN_CAPABILITIES];
  if (role === 'coach') return [CAPABILITIES.EVENTS_VIEW_PUBLIC, CAPABILITIES.ATHLETES_MANAGE];
  if (role === 'athlete') return [CAPABILITIES.EVENTS_VIEW_PUBLIC];
  return [];
}
