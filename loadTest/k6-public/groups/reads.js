import { API, runFlags } from '../core/config.js';
import { STATUS_POLICIES } from '../core/policies.js';
import { request } from '../core/request.js';

function buildAuthMeEndpoint(token) {
  return token
    ? [
        () =>
          request('GET', `${API}/api/auth/me`, {
            token,
            allowedStatuses: STATUS_POLICIES.authenticatedRead,
          }),
      ]
    : [];
}

function buildAdminEventReadEndpoints({
  adminToken,
  eventId,
  eventWeightCategoryId,
  bracketId,
}) {
  if (!adminToken) {
    return [];
  }

  return [
    () =>
      request('GET', `${API}/api/events`, {
        token: adminToken,
        allowedStatuses: STATUS_POLICIES.authenticatedRead,
      }),
    ...(eventId
      ? [
          () =>
            request('GET', `${API}/api/events/${eventId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/events/${eventId}/summary`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/events/${eventId}/categories`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    ...(eventId
      ? [
          () =>
            request('GET', `${API}/api/draw/overview?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/brackets?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/brackets/overview?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    ...(eventId && eventWeightCategoryId
      ? [
          () =>
            request(
              'GET',
              `${API}/api/draw/category?eventId=${encodeURIComponent(eventId)}&eventWeightCategoryId=${encodeURIComponent(eventWeightCategoryId)}`,
              {
                token: adminToken,
                allowedStatuses: STATUS_POLICIES.authenticatedRead,
              }
            ),
          () =>
            request(
              'GET',
              `${API}/api/brackets/category?eventId=${encodeURIComponent(eventId)}&eventWeightCategoryId=${encodeURIComponent(eventWeightCategoryId)}`,
              {
                token: adminToken,
                allowedStatuses: STATUS_POLICIES.authenticatedRead,
              }
            ),
        ]
      : []),
    ...(bracketId
      ? [
          () =>
            request('GET', `${API}/api/brackets/${bracketId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
  ];
}

function buildAdminCompetitionReadEndpoints({ adminToken, fightId, eventId, matId }) {
  if (!adminToken) {
    return [];
  }

  return [
    ...(eventId
      ? [
          () =>
            request('GET', `${API}/api/fights?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request(
              'GET',
              `${API}/api/fights/live/category-board?eventId=${encodeURIComponent(eventId)}${matId ? `&matId=${encodeURIComponent(matId)}` : ''}`,
              {
                token: adminToken,
                allowedStatuses: STATUS_POLICIES.authenticatedRead,
              }
            ),
          () =>
            request('GET', `${API}/api/results?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/results/summary?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/mats?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/schedule?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request('GET', `${API}/api/weighin?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    ...(fightId
      ? [
          () =>
            request('GET', `${API}/api/fights/${fightId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
  ];
}

function buildAdminManagementReadEndpoints({
  adminToken,
  userId,
  rulesetId,
  eventId,
}) {
  if (!adminToken) {
    return [];
  }

  return [
    () => request('GET', `${API}/api/admin/users`, { token: adminToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
    ...(userId
      ? [
          () =>
            request('GET', `${API}/api/admin/users/${userId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    () => request('GET', `${API}/api/rulesets`, { token: adminToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
    ...(rulesetId
      ? [
          () =>
            request('GET', `${API}/api/rulesets/${rulesetId}/age-groups`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    ...(eventId
      ? [
          () =>
            request('GET', `${API}/api/integrity?eventId=${encodeURIComponent(eventId)}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    () => request('GET', `${API}/api/event-policies/options`, { token: adminToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
    ...(eventId
      ? [
          () =>
            request('GET', `${API}/api/event-policies/events/${eventId}`, {
              token: adminToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
    () => request('GET', `${API}/api/forms/submissions`, { token: adminToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
    () => request('GET', `${API}/api/admin/news`, { token: adminToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
  ];
}

export function buildAdminReadEndpoints(context) {
  return [
    ...buildAuthMeEndpoint(context.adminToken),
    ...buildAdminEventReadEndpoints(context),
    ...buildAdminCompetitionReadEndpoints(context),
    ...buildAdminManagementReadEndpoints(context),
  ];
}

export function buildCoachReadEndpoints({ coachToken }) {
  if (!coachToken) {
    return [];
  }

  return [
    ...buildAuthMeEndpoint(coachToken),
    () => request('GET', `${API}/api/registrations`, { token: coachToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
    () => request('GET', `${API}/api/athletes`, { token: coachToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
    () => request('GET', `${API}/api/clubs`, { token: coachToken, allowedStatuses: STATUS_POLICIES.authenticatedRead }),
  ];
}

export function buildJudgeReadEndpoints({ judgeToken, fightId, eventId, matId }) {
  if (!judgeToken) {
    return [];
  }

  return [
    ...(eventId
      ? [
          () =>
            request('GET', `${API}/api/fights?eventId=${encodeURIComponent(eventId)}`, {
              token: judgeToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
          () =>
            request(
              'GET',
              `${API}/api/fights/live/category-board?eventId=${encodeURIComponent(eventId)}${matId ? `&matId=${encodeURIComponent(matId)}` : ''}`,
              {
                token: judgeToken,
                allowedStatuses: STATUS_POLICIES.authenticatedRead,
              }
            ),
        ]
      : []),
    ...(fightId
      ? [
          () =>
            request('GET', `${API}/api/fights/${fightId}`, {
              token: judgeToken,
              allowedStatuses: STATUS_POLICIES.authenticatedRead,
            }),
        ]
      : []),
  ];
}

export function buildUserReadEndpoints({ userToken }) {
  return buildAuthMeEndpoint(userToken);
}

export function buildOptionalContactEndpoints() {
  if (!runFlags.contactForm) {
    return [];
  }

  return [
    () =>
      request('POST', `${API}/api/forms/contact`, {
        body: {
          name: 'k6 Test',
          email: 'k6@example.com',
          type: 'contact',
          message: 'Hello from k6',
          website: '',
        },
        allowedStatuses: STATUS_POLICIES.mutation,
      }),
  ];
}
