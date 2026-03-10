import { API, runFlags } from '../core/config.js';
import { STATUS_POLICIES } from '../core/policies.js';
import { request } from '../core/request.js';

export function buildDestructiveEndpoints({ adminToken, eventId, userId }) {
  if (!runFlags.mutations || !runFlags.destructive) {
    return [];
  }

  return [
    ...(eventId
      ? [
          () =>
            request('DELETE', `${API}/api/events/${eventId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.mutation,
            }),
        ]
      : []),
    ...(userId
      ? [
          () =>
            request('DELETE', `${API}/api/admin/users/${userId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.mutation,
            }),
        ]
      : []),
  ];
}
