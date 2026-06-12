import type { EventLifecycle } from '@/types/api';

export const EVENT_LIFECYCLE_ORDER: EventLifecycle[] = [
  'REG_OPEN',
  'LOCKED',
  'WEIGHIN',
  'WEIGH_IN_COMPLETED',
  'DRAWN',
  'PUBLISHED',
  'LIVE',
  'COMPLETED',
];

export function nextEventLifecycle(
  current: EventLifecycle,
): EventLifecycle | null {
  const currentIndex = EVENT_LIFECYCLE_ORDER.indexOf(current);
  if (currentIndex < 0 || currentIndex >= EVENT_LIFECYCLE_ORDER.length - 1) {
    return null;
  }
  return EVENT_LIFECYCLE_ORDER[currentIndex + 1];
}

