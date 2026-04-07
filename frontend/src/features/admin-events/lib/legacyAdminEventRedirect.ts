import { type AdminEventRoutePage, getAdminEventPath } from './adminEventRoutes';

type SearchParamValue = string | string[] | undefined;

type Input = {
  locale: string;
  page: Exclude<AdminEventRoutePage, 'overview'>;
  searchParams: Record<string, SearchParamValue>;
};

function firstValue(value: SearchParamValue): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function getLegacyAdminEventRedirectTarget({
  locale,
  page,
  searchParams,
}: Input): string {
  const eventId = firstValue(searchParams.eventId);
  if (!eventId) {
    return `/${locale}/admin/events`;
  }

  const nextSearchParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === 'eventId' || value == null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => nextSearchParams.append(key, entry));
      return;
    }
    nextSearchParams.set(key, value);
  });

  const targetPath = getAdminEventPath(locale, eventId, page);
  const queryString = nextSearchParams.toString();
  return queryString ? `${targetPath}?${queryString}` : targetPath;
}
