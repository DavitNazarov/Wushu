import { localizedFullName, localizedName } from '@/lib/bilingual';
import type { AthleteRow, EventRow, RegistrationRow } from '@/types/api';
import type {
  CoachDashboardViewModel,
  DashboardPendingAction,
  DashboardQuickAction,
  DashboardRecentUpdate,
  DashboardRegistrationsByEvent,
  DashboardUpcomingEvent,
} from './types';

type BuildDashboardModelArgs = {
  athletes: AthleteRow[];
  events: EventRow[];
  registrationsByEvent: DashboardRegistrationsByEvent;
  locale: string;
  now: Date;
};

const ACTIVE_REGISTRATION_STATUSES = new Set(['PENDING', 'SUBMITTED', 'APPROVED']);
const REJECTED_REGISTRATION_STATUS = 'REJECTED';
const WEIGHIN_LIFECYCLES = new Set(['WEIGHIN', 'WEIGH_IN_COMPLETED']);
const UPCOMING_LIFECYCLES = new Set(['REG_OPEN', 'WEIGHIN', 'WEIGH_IN_COMPLETED', 'LOCKED', 'DRAWN', 'PUBLISHED', 'LIVE']);

function isActiveRegistration(status: RegistrationRow['status']): boolean {
  return ACTIVE_REGISTRATION_STATUSES.has(status);
}

function byDateAsc(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function byDateDesc(left: string | null, right: string | null): number {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}

function getAthleteName(
  athlete: { firstName: string; lastName: string; firstNameKa?: string | null; lastNameKa?: string | null },
  locale: string,
): string {
  return localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale).trim();
}

function athleteMissingInfo(athlete: AthleteRow): boolean {
  return !athlete.documentId || !athlete.dateOfBirth || !athlete.sex;
}

function resolveRegistrationsForEvent(eventId: string, registrationsByEvent: DashboardRegistrationsByEvent): RegistrationRow[] {
  return registrationsByEvent[eventId] ?? [];
}

function buildPendingActions(
  athletes: AthleteRow[],
  upcomingEvents: DashboardUpcomingEvent[],
  registrationsByEvent: DashboardRegistrationsByEvent,
  locale: string,
  now: Date,
): DashboardPendingAction[] {
  const actions: DashboardPendingAction[] = [];

  athletes.filter(athleteMissingInfo).forEach((athlete) => {
    actions.push({
      id: `athlete-${athlete.id}`,
      priority: 'high',
      titleKey: 'completeAthleteProfile',
      athleteName: getAthleteName(athlete, locale),
      href: `/${locale}/coach/athletes`,
      sortAt: now.toISOString(),
    });
  });

  upcomingEvents.forEach((event) => {
    const eventName = localizedName(event.name, event.nameKa, locale);

    if (event.availableAthletesCount > 0 && event.registrationStatus === 'OPEN') {
      actions.push({
        id: `registration-open-${event.id}`,
        priority: 'high',
        titleKey: 'registrationOpen',
        eventName,
        athleteCount: event.availableAthletesCount,
        href: event.href,
        sortAt: event.registrationClosesAt ?? event.competitionStartDate,
      });
    }

    if (event.registrationStatus === 'OPEN' && event.registrationClosesAt) {
      const closesInMs = new Date(event.registrationClosesAt).getTime() - now.getTime();
      const closesSoon = closesInMs >= 0 && closesInMs <= 3 * 24 * 60 * 60 * 1000;
      if (closesSoon) {
        actions.push({
          id: `registration-deadline-${event.id}`,
          priority: 'medium',
          titleKey: 'registrationClosingSoon',
          eventName,
          dueDate: event.registrationClosesAt,
          href: event.href,
          sortAt: event.registrationClosesAt,
        });
      }
    }

    if (WEIGHIN_LIFECYCLES.has(event.lifecycle)) {
      const pendingCount = resolveRegistrationsForEvent(event.id, registrationsByEvent).filter((registration) =>
        isActiveRegistration(registration.status),
      ).length;
      if (pendingCount > 0) {
        actions.push({
          id: `weighin-${event.id}`,
          priority: 'high',
          titleKey: 'weighInActive',
          eventName,
          registrationCount: pendingCount,
          href: event.href,
          sortAt: event.competitionStartDate,
        });
      }
    }

    resolveRegistrationsForEvent(event.id, registrationsByEvent)
      .filter((registration) => registration.status === REJECTED_REGISTRATION_STATUS)
      .forEach((registration) => {
        actions.push({
          id: `rejected-${registration.id}`,
          priority: 'medium',
          titleKey: 'registrationRejected',
          athleteName: registration.athlete
            ? getAthleteName(registration.athlete, locale)
            : registration.athleteId,
          eventName,
          href: event.href,
          sortAt: registration.updatedAt ?? registration.createdAt ?? event.competitionStartDate,
        });
      });
  });

  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return actions.sort((left, right) => {
    const priorityDelta = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return byDateAsc(left.sortAt ?? now.toISOString(), right.sortAt ?? now.toISOString());
  });
}

function buildRecentUpdates(
  events: EventRow[],
  registrationsByEvent: DashboardRegistrationsByEvent,
  locale: string,
): DashboardRecentUpdate[] {
  return events
    .flatMap((event) =>
      resolveRegistrationsForEvent(event.id, registrationsByEvent).map((registration) => {
        const athleteName = registration.athlete
          ? getAthleteName(registration.athlete, locale)
          : registration.athleteId;
        const eventName = localizedName(event.name, event.nameKa, locale);
        const timestamp = registration.updatedAt ?? registration.createdAt ?? null;
        let textKey: DashboardRecentUpdate['textKey'] = 'registrationSubmitted';

        if (event.lifecycle === 'WEIGHIN' || event.lifecycle === 'WEIGH_IN_COMPLETED') textKey = 'weighInInProgress';
        else if (event.lifecycle === 'PUBLISHED' || event.lifecycle === 'DRAWN') textKey = 'eventPublished';
        else if (event.lifecycle === 'LIVE') textKey = 'competitionLive';
        else if (event.lifecycle === 'COMPLETED') textKey = 'eventCompleted';
        else if (registration.status === 'APPROVED') textKey = 'registrationApproved';
        else if (registration.status === 'PENDING') textKey = 'registrationPending';
        else if (registration.status === 'REJECTED') textKey = 'registrationRejected';
        else if (registration.status === 'WITHDRAWN') textKey = 'registrationWithdrawn';

        return {
          id: registration.id,
          athleteName,
          eventName,
          status: registration.status,
          lifecycle: event.lifecycle,
          href: `/${locale}/coach/events/${event.slug}/registrations`,
          timestamp,
          textKey,
          categoryCode: registration.categoryCode,
          searchText: `${athleteName} ${event.name} ${event.nameKa ?? ''} ${registration.categoryCode}`.toLowerCase(),
        };
      }),
    )
    .sort((left, right) => {
      const datedDelta = byDateDesc(left.timestamp, right.timestamp);
      if (datedDelta !== 0) return datedDelta;
      return left.eventName.localeCompare(right.eventName);
    });
}

function buildQuickActions(upcomingEvents: DashboardUpcomingEvent[], locale: string): DashboardQuickAction[] {
  const nextEvent =
    upcomingEvents.find((event) => event.lifecycle === 'REG_OPEN' && event.registrationStatus === 'OPEN') ??
    upcomingEvents.find((event) => event.lifecycle === 'REG_OPEN') ??
    upcomingEvents.find((event) => WEIGHIN_LIFECYCLES.has(event.lifecycle)) ??
    upcomingEvents[0];
  const weighInEvent = upcomingEvents.find((event) => WEIGHIN_LIFECYCLES.has(event.lifecycle));

  return [
    {
      id: 'athletes',
      href: `/${locale}/coach/athletes`,
      labelKey: 'athletes',
      descriptionKey: 'manageAthletes',
    },
    {
      id: 'events',
      href: `/${locale}/coach/events`,
      labelKey: 'events',
      descriptionKey: 'browseEvents',
    },
    {
      id: 'registrations',
      href: nextEvent?.href ?? `/${locale}/coach/events`,
      labelKey: 'registrations',
      descriptionKey: 'manageRegistrations',
    },
    ...(weighInEvent
      ? [
          {
            id: 'weighin',
            href: weighInEvent.href,
            labelKey: 'weighIn',
            descriptionKey: 'reviewWeighIn',
          } satisfies DashboardQuickAction,
        ]
      : []),
    {
      id: 'profile',
      href: `/${locale}/coach/me`,
      labelKey: 'profile',
      descriptionKey: 'openProfile',
    },
  ];
}

export function buildCoachDashboardModel({
  athletes,
  events,
  registrationsByEvent,
  locale,
  now,
}: BuildDashboardModelArgs): CoachDashboardViewModel {
  const upcomingEvents = events
    .filter((event) => UPCOMING_LIFECYCLES.has(event.lifecycle) && new Date(event.competitionEndDate).getTime() >= now.getTime())
    .sort((left, right) => byDateAsc(left.competitionStartDate, right.competitionStartDate))
    .map((event): DashboardUpcomingEvent => {
      const registrations = resolveRegistrationsForEvent(event.id, registrationsByEvent);
      const activeRegistrations = registrations.filter((registration) => isActiveRegistration(registration.status));
      const registeredAthleteIds = new Set(activeRegistrations.map((registration) => registration.athleteId));

      return {
        id: event.id,
        name: event.name,
        nameKa: event.nameKa,
        slug: event.slug,
        location: event.location,
        lifecycle: event.lifecycle,
        registrationStatus: event.registrationStatus,
        competitionStartDate: event.competitionStartDate,
        competitionEndDate: event.competitionEndDate,
        registrationOpensAt: event.registrationOpensAt,
        registrationClosesAt: event.registrationClosesAt,
        registrationsCount: activeRegistrations.length,
        availableAthletesCount: athletes.filter((athlete) => !registeredAthleteIds.has(athlete.id)).length,
        href: `/${locale}/coach/events/${event.slug}/registrations`,
      };
    });

  const summary = {
    totalAthletes: athletes.length,
    activeRegistrations: upcomingEvents.reduce((count, event) => count + event.registrationsCount, 0),
    // Existing coach payloads do not expose per-registration weigh-in completion,
    // so the dashboard uses active registrations in current weigh-in stage events.
    pendingWeighIns: upcomingEvents
      .filter((event) => WEIGHIN_LIFECYCLES.has(event.lifecycle))
      .reduce((count, event) => count + event.registrationsCount, 0),
    upcomingEvents: upcomingEvents.length,
  };

  const recentUpdates = buildRecentUpdates(events, registrationsByEvent, locale);

  return {
    summary,
    pendingActions: buildPendingActions(athletes, upcomingEvents, registrationsByEvent, locale, now),
    upcomingEvents,
    recentUpdates,
    quickActions: buildQuickActions(upcomingEvents, locale),
    athletesMissingInfo: athletes.filter(athleteMissingInfo),
    hasExactUpdateTimestamps: recentUpdates.every((update) => Boolean(update.timestamp)),
  };
}
