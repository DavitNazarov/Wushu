import type { EventLifecycle, EventRow } from '@/types/api';

export type EventControlPageKey =
  | 'registrations'
  | 'weighin'
  | 'integrity'
  | 'draw'
  | 'schedule'
  | 'live';

export type EventControlGateMode =
  | 'unselected'
  | 'active'
  | 'upcoming'
  | 'locked'
  | 'readonly';

export type EventControlGateState = {
  page: EventControlPageKey;
  mode: EventControlGateMode;
  event: EventRow | null;
  dateIso: string | null;
  activeLifecycles: EventLifecycle[];
};

type EventControlPageConfig = {
  activeLifecycles: EventLifecycle[];
  readonlyLifecycles?: EventLifecycle[];
  lockedLifecycles?: EventLifecycle[];
  getDateIso: (event: EventRow, mode: Exclude<EventControlGateMode, 'unselected' | 'active'>) => string | null;
};

const EVENT_CONTROL_PAGE_CONFIG: Record<EventControlPageKey, EventControlPageConfig> = {
  registrations: {
    activeLifecycles: ['REG_OPEN'],
    lockedLifecycles: [
      'LOCKED',
      'WEIGHIN',
      'WEIGH_IN_COMPLETED',
      'DRAWN',
      'PUBLISHED',
      'LIVE',
      'COMPLETED',
    ],
    getDateIso: (event, mode) =>
      mode === 'upcoming'
        ? event.registrationOpensAt ?? event.registrationStartDate
        : event.registrationClosesAt ?? event.registrationEndDate,
  },
  weighin: {
    activeLifecycles: ['WEIGHIN'],
    lockedLifecycles: ['WEIGH_IN_COMPLETED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'],
    getDateIso: (event, mode) =>
      mode === 'upcoming'
        ? event.weighInStartDate
        : event.weighInEndDate ?? event.weighInStartDate ?? null,
  },
  integrity: {
    activeLifecycles: ['LOCKED', 'WEIGHIN'],
    readonlyLifecycles: ['WEIGH_IN_COMPLETED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'],
    getDateIso: (event, mode) =>
      mode === 'upcoming'
        ? event.registrationClosesAt ?? event.registrationEndDate
        : event.weighInEndDate ?? event.weighInStartDate ?? null,
  },
  draw: {
    activeLifecycles: ['LOCKED', 'WEIGHIN', 'WEIGH_IN_COMPLETED'],
    readonlyLifecycles: ['DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'],
    getDateIso: (event, mode) =>
      mode === 'upcoming'
        ? event.registrationClosesAt ?? event.registrationEndDate
        : null,
  },
  schedule: {
    activeLifecycles: ['DRAWN', 'PUBLISHED', 'LIVE'],
    readonlyLifecycles: ['COMPLETED'],
    getDateIso: (event, mode) =>
      mode === 'upcoming' ? event.competitionStartDate : event.competitionEndDate,
  },
  live: {
    activeLifecycles: ['LIVE'],
    readonlyLifecycles: ['COMPLETED'],
    getDateIso: (event, mode) =>
      mode === 'upcoming' ? event.competitionStartDate : event.competitionEndDate,
  },
};

export function resolveEventControlGate(
  page: EventControlPageKey,
  event: EventRow | null,
): EventControlGateState {
  const config = EVENT_CONTROL_PAGE_CONFIG[page];
  if (!event) {
    return {
      page,
      mode: 'unselected',
      event: null,
      dateIso: null,
      activeLifecycles: config.activeLifecycles,
    };
  }

  if (config.activeLifecycles.includes(event.lifecycle)) {
    return {
      page,
      mode: 'active',
      event,
      dateIso: null,
      activeLifecycles: config.activeLifecycles,
    };
  }

  if (config.readonlyLifecycles?.includes(event.lifecycle)) {
    return {
      page,
      mode: 'readonly',
      event,
      dateIso: config.getDateIso(event, 'readonly'),
      activeLifecycles: config.activeLifecycles,
    };
  }

  if (config.lockedLifecycles?.includes(event.lifecycle)) {
    return {
      page,
      mode: 'locked',
      event,
      dateIso: config.getDateIso(event, 'locked'),
      activeLifecycles: config.activeLifecycles,
    };
  }

  return {
    page,
    mode: 'upcoming',
    event,
    dateIso: config.getDateIso(event, 'upcoming'),
    activeLifecycles: config.activeLifecycles,
  };
}
