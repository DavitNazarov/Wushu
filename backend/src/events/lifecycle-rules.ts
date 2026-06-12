import type { EventLifecycle } from '@prisma/client';

// Canonical ordering of the event lifecycle. Internal-only — the sole
// consumers are the transition helpers below. (Weigh-in completion helpers
// live in ./weighin-completion.helper, which is the canonical source.)
const EVENT_LIFECYCLE_ORDER: EventLifecycle[] = [
  'REG_OPEN',
  'LOCKED',
  'WEIGHIN',
  'WEIGH_IN_COMPLETED',
  'DRAWN',
  'PUBLISHED',
  'LIVE',
  'COMPLETED',
];

const REGISTRATION_MUTABLE_STAGES = new Set<EventLifecycle>(['REG_OPEN']);

const SCHEDULE_MUTABLE_STAGES = new Set<EventLifecycle>([
  'DRAWN',
  'PUBLISHED',
  'LIVE',
]);

export function isEventReadOnly(lifecycle: EventLifecycle): boolean {
  return lifecycle === 'COMPLETED';
}

export function isRegistrationMutableLifecycle(
  lifecycle: EventLifecycle,
): boolean {
  return REGISTRATION_MUTABLE_STAGES.has(lifecycle);
}

export function canManageSchedule(lifecycle: EventLifecycle): boolean {
  return SCHEDULE_MUTABLE_STAGES.has(lifecycle);
}

export function canRunLiveCompetition(lifecycle: EventLifecycle): boolean {
  return lifecycle === 'LIVE';
}

export function isWeighInStage(lifecycle: EventLifecycle): boolean {
  return lifecycle === 'WEIGHIN';
}

function getLifecycleIndex(lifecycle: EventLifecycle): number {
  return EVENT_LIFECYCLE_ORDER.indexOf(lifecycle);
}

export function getNextLifecycle(
  lifecycle: EventLifecycle,
): EventLifecycle | null {
  const currentIndex = getLifecycleIndex(lifecycle);
  if (currentIndex < 0 || currentIndex >= EVENT_LIFECYCLE_ORDER.length - 1)
    return null;
  return EVENT_LIFECYCLE_ORDER[currentIndex + 1];
}

export function isForwardLifecycleTransition(
  current: EventLifecycle,
  target: EventLifecycle,
): boolean {
  const currentIndex = getLifecycleIndex(current);
  const targetIndex = getLifecycleIndex(target);
  if (currentIndex < 0 || targetIndex < 0) return false;
  return targetIndex > currentIndex;
}

export function isBackwardLifecycleTransition(
  current: EventLifecycle,
  target: EventLifecycle,
): boolean {
  const currentIndex = getLifecycleIndex(current);
  const targetIndex = getLifecycleIndex(target);
  if (currentIndex < 0 || targetIndex < 0) return false;
  return targetIndex < currentIndex;
}
