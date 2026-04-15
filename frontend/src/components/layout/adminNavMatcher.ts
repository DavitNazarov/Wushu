import type { AdminNavItemKey } from './adminNavConfig';
import { adminNavSections } from './adminNavConfig';
import { ADMIN_EVENT_ROUTE_SEGMENTS } from '@/features/admin-events/lib/adminEventRoutes';

const ADMIN_CHILD_SEGMENT_TO_NAV_KEY = adminNavSections
  .flatMap((section) => section.items)
  .reduce<Partial<Record<string, AdminNavItemKey>>>((mapping, item) => {
    const [, childSegment] = item.href.split('/').filter(Boolean);
    if (childSegment) {
      mapping[childSegment] = item.key;
    }
    return mapping;
  }, {});

const ADMIN_EVENT_SECTION_TO_NAV_KEY: Record<string, AdminNavItemKey> = {
  [ADMIN_EVENT_ROUTE_SEGMENTS.registrations]: 'registrations',
  [ADMIN_EVENT_ROUTE_SEGMENTS.weighin]: 'weighin',
  integrity: 'integrity',
  [ADMIN_EVENT_ROUTE_SEGMENTS.draw]: 'draw',
  [ADMIN_EVENT_ROUTE_SEGMENTS.brackets]: 'brackets',
  [ADMIN_EVENT_ROUTE_SEGMENTS.schedule]: 'schedule',
  [ADMIN_EVENT_ROUTE_SEGMENTS.live]: 'live',
  [ADMIN_EVENT_ROUTE_SEGMENTS.results]: 'results',
};

function getNormalizedPathSegments(pathname: string, locale: string): string[] {
  const normalizedPath = (pathname.split(/[?#]/u)[0] ?? '').replace(/\/+$/u, '');
  const segments = normalizedPath.split('/').filter(Boolean);

  return segments[0] === locale ? segments.slice(1) : segments;
}

export function getActiveAdminNavKey(
  pathname: string,
  locale: string,
): AdminNavItemKey | null {
  const segments = getNormalizedPathSegments(pathname, locale);
  if (segments[0] === 'display') return 'display';
  if (segments[0] !== 'admin') return null;
  if (segments.length === 1) return 'dashboard';

  const adminChildSegment = segments[1];
  if (adminChildSegment !== 'events') {
    return ADMIN_CHILD_SEGMENT_TO_NAV_KEY[adminChildSegment] ?? null;
  }

  const eventSectionSegment = segments[3];
  if (!eventSectionSegment) {
    return 'events';
  }

  return ADMIN_EVENT_SECTION_TO_NAV_KEY[eventSectionSegment] ?? null;
}
