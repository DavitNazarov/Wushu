import { API, EVENT_SLUG, MAT_NAME } from '../core/config.js';
import { STATUS_POLICIES } from '../core/policies.js';
import { request } from '../core/request.js';

export function buildPublicGetEndpoints({
  newsSlug,
  publicBracketCategoryId,
  publicMatName,
}) {
  const eventSlug = encodeURIComponent(EVENT_SLUG);
  const resolvedMatName = publicMatName || MAT_NAME;

  return [
    () => request('GET', `${API}/api/public/events`, { allowedStatuses: STATUS_POLICIES.publicRead }),
    () =>
      request('GET', `${API}/api/public/events/${eventSlug}`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    () =>
      request('GET', `${API}/api/public/events/${eventSlug}/categories`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    () => request('GET', `${API}/api/public/news`, { allowedStatuses: STATUS_POLICIES.publicRead }),
    ...(newsSlug
      ? [
          () =>
            request('GET', `${API}/api/public/news/${encodeURIComponent(newsSlug)}`, {
              allowedStatuses: STATUS_POLICIES.publicRead,
            }),
        ]
      : []),
    () => request('GET', `${API}/api/public/clubs`, { allowedStatuses: STATUS_POLICIES.publicRead }),
    () =>
      request('GET', `${API}/api/public/brackets/overview?eventSlug=${eventSlug}`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    ...(publicBracketCategoryId
      ? [
          () =>
            request(
              'GET',
              `${API}/api/public/brackets/category?eventSlug=${eventSlug}&eventWeightCategoryId=${encodeURIComponent(publicBracketCategoryId)}`,
              {
                allowedStatuses: STATUS_POLICIES.publicRead,
              }
            ),
        ]
      : []),
    () =>
      request('GET', `${API}/api/public/brackets?eventSlug=${eventSlug}`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    () =>
      request('GET', `${API}/api/public/schedule?eventSlug=${eventSlug}`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    () =>
      request('GET', `${API}/api/public/live?eventSlug=${eventSlug}`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    () =>
      request('GET', `${API}/api/public/results?eventSlug=${eventSlug}`, {
        allowedStatuses: STATUS_POLICIES.publicRead,
      }),
    ...(resolvedMatName
      ? [
          () =>
            request(
              'GET',
              `${API}/api/public/mat?eventSlug=${eventSlug}&mat=${encodeURIComponent(resolvedMatName)}`,
              {
                allowedStatuses: STATUS_POLICIES.publicRead,
              }
            ),
        ]
      : []),
  ];
}
