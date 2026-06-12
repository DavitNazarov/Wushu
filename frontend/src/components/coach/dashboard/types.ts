import type { AthleteRow, EventLifecycle, EventRow, RegistrationRow, RegistrationStatus } from '@/types/api';

export type CoachDashboardContext = {
  clubId: string | null;
  clubName: string | null;
  displayName: string | null;
  organisationName: string | null;
};

export type DashboardRegistrationsByEvent = Record<string, RegistrationRow[]>;

export type DashboardSummary = {
  totalAthletes: number;
  activeRegistrations: number;
  pendingWeighIns: number;
  upcomingEvents: number;
};

type DashboardActionPriority = 'high' | 'medium' | 'low';

export type DashboardPendingAction = {
  id: string;
  priority: DashboardActionPriority;
  titleKey:
    | 'completeAthleteProfile'
    | 'registrationOpen'
    | 'registrationClosingSoon'
    | 'weighInActive'
    | 'registrationRejected';
  athleteName?: string;
  athleteCount?: number;
  eventName?: string;
  registrationCount?: number;
  dueDate?: string | null;
  href: string;
  sortAt: string | null;
};

export type DashboardUpcomingEvent = {
  id: string;
  name: string;
  nameKa: string | null;
  slug: string;
  location: string | null;
  lifecycle: EventLifecycle;
  registrationStatus: EventRow['registrationStatus'];
  competitionStartDate: string;
  competitionEndDate: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationsCount: number;
  availableAthletesCount: number;
  href: string;
};

export type DashboardRecentUpdate = {
  id: string;
  athleteName: string;
  eventName: string;
  status: RegistrationStatus;
  lifecycle: EventLifecycle;
  href: string;
  timestamp: string | null;
  textKey:
    | 'registrationSubmitted'
    | 'registrationApproved'
    | 'registrationPending'
    | 'registrationRejected'
    | 'registrationWithdrawn'
    | 'weighInInProgress'
    | 'eventPublished'
    | 'competitionLive'
    | 'eventCompleted';
  categoryCode: string;
  searchText: string;
};

export type DashboardQuickAction = {
  id: string;
  href: string;
  labelKey: 'athletes' | 'events' | 'registrations' | 'weighIn' | 'profile';
  descriptionKey:
    | 'manageAthletes'
    | 'browseEvents'
    | 'manageRegistrations'
    | 'reviewWeighIn'
    | 'openProfile';
};

export type CoachDashboardViewModel = {
  summary: DashboardSummary;
  pendingActions: DashboardPendingAction[];
  upcomingEvents: DashboardUpcomingEvent[];
  recentUpdates: DashboardRecentUpdate[];
  quickActions: DashboardQuickAction[];
  athletesMissingInfo: AthleteRow[];
  hasExactUpdateTimestamps: boolean;
};
