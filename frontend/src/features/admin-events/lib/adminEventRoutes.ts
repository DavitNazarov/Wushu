export const ADMIN_EVENT_ROUTE_SEGMENTS = {
  overview: '',
  registrations: 'registrations',
  weighin: 'weigh-in',
  // Key stays `draw` internally (gate/matcher/nav all key on it); only the
  // user-visible URL segment + labels became "weigh-in results".
  draw: 'weighin-results',
  brackets: 'brackets',
  schedule: 'schedule',
  live: 'live',
  results: 'results',
} as const;

export type AdminEventRoutePage = keyof typeof ADMIN_EVENT_ROUTE_SEGMENTS;

const ADMIN_EVENT_ROUTE_PAGES = Object.keys(
  ADMIN_EVENT_ROUTE_SEGMENTS,
) as AdminEventRoutePage[];

export const ADMIN_EVENT_NAV_PAGES: AdminEventRoutePage[] = [
  'overview',
  'registrations',
  'weighin',
  'draw',
  'brackets',
  'schedule',
  'live',
  'results',
];

const ADMIN_EVENT_SEGMENT_TO_PAGE = Object.fromEntries(
  ADMIN_EVENT_ROUTE_PAGES.map((page) => [ADMIN_EVENT_ROUTE_SEGMENTS[page], page]),
) as Record<string, AdminEventRoutePage>;

export function getAdminEventPath(
  locale: string,
  eventId: string,
  page: AdminEventRoutePage = 'overview',
): string {
  const basePath = `/${locale}/admin/events/${eventId}`;
  const segment = ADMIN_EVENT_ROUTE_SEGMENTS[page];
  return segment ? `${basePath}/${segment}` : basePath;
}

export function matchAdminEventRoute(
  pathname: string,
  locale: string,
): { eventId: string; page: AdminEventRoutePage } | null {
  const adminPrefix = `/${locale}/admin/events/`;
  if (!pathname.startsWith(adminPrefix)) return null;

  const routeRemainder = pathname.slice(adminPrefix.length);
  const [eventId = '', routeSegment = ''] = routeRemainder.split('/');
  if (!eventId) return null;

  const page = ADMIN_EVENT_SEGMENT_TO_PAGE[routeSegment];
  if (routeSegment && !page) return null;

  return {
    eventId,
    page: page ?? 'overview',
  };
}

export function appendQueryString(path: string, searchParams: URLSearchParams): string {
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}
