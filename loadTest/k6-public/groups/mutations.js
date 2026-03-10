import { API, MAT_NAME, runFlags } from '../core/config.js';
import { STATUS_POLICIES } from '../core/policies.js';
import { request } from '../core/request.js';

function mutation(method, url, token = '', body = null) {
  return request(method, url, {
    token,
    body,
    allowedStatuses: STATUS_POLICIES.mutation,
  });
}

function buildAuthMutations({ adminToken }) {
  const suffix = `${__VU}-${__ITER}`;

  return [
    () =>
      mutation('POST', `${API}/api/auth/signup`, adminToken, {
        email: `k6+${suffix}@example.com`,
        password: 'Password123!',
        firstName: 'K6',
        lastName: 'User',
        role: 'COACH',
      }),
    () =>
      mutation('POST', `${API}/api/auth/bootstrap-admin`, '', {
        email: `bootstrap+${suffix}@example.com`,
        password: 'Password123!',
        firstName: 'Boot',
        lastName: 'Admin',
      }),
  ];
}

function buildEventMutations({ adminToken, eventId }) {
  const suffix = `${__VU}-${__ITER}`;

  return [
    () => mutation('POST', `${API}/api/events/stage-automation/run`, adminToken, {}),
    ...(eventId
      ? [
          () => mutation('POST', `${API}/api/events/${eventId}/run-automation`, adminToken, {}),
          () =>
            mutation('PATCH', `${API}/api/events/${eventId}`, adminToken, {
              name: `Updated Event ${suffix}`,
            }),
          () =>
            mutation('POST', `${API}/api/events/${eventId}/lifecycle`, adminToken, {
              action: 'next',
            }),
          () =>
            mutation('POST', `${API}/api/events/${eventId}/publish`, adminToken, {
              published: true,
            }),
          () =>
            mutation('POST', `${API}/api/events/${eventId}/categories`, adminToken, {
              categories: [],
            }),
        ]
      : []),
    () =>
      mutation('POST', `${API}/api/events`, adminToken, {
        name: `K6 Event ${suffix}`,
        slug: `k6-event-${suffix}`,
      }),
  ];
}

function buildDrawMutations({ adminToken, eventId }) {
  return eventId
    ? [
        () => mutation('POST', `${API}/api/draw`, adminToken, { eventId }),
        () => mutation('POST', `${API}/api/draw/reset`, adminToken, { eventId }),
      ]
    : [];
}

function buildFightMutations({ adminToken, judgeToken, fightId, athleteId }) {
  const officialToken = judgeToken || adminToken;

  if (!officialToken || !fightId) {
    return [];
  }

  return [
    () =>
      mutation('POST', `${API}/api/fights/${fightId}/state`, officialToken, {
        state: 'READY',
      }),
    () => mutation('POST', `${API}/api/fights/${fightId}/start`, officialToken, {}),
    () => mutation('POST', `${API}/api/fights/${fightId}/finish`, officialToken, {}),
    () =>
      mutation('POST', `${API}/api/fights/${fightId}/timer`, officialToken, {
        action: 'start',
      }),
    () =>
      mutation('POST', `${API}/api/fights/${fightId}/result`, officialToken, {
        winnerId: athleteId || undefined,
        method: 'POINTS',
      }),
  ];
}

function buildScheduleMutations({ adminToken, eventId, fightId }) {
  const suffix = `${__VU}-${__ITER}`;

  return [
    () =>
      mutation('POST', `${API}/api/mats`, adminToken, {
        name: `k6-mat-${suffix}`,
      }),
    ...(eventId
      ? [() => mutation('POST', `${API}/api/schedule/auto`, adminToken, { eventId })]
      : []),
    ...(fightId
      ? [
          () =>
            mutation('POST', `${API}/api/schedule/move`, adminToken, {
              fightId,
              targetMat: MAT_NAME,
            }),
        ]
      : []),
  ];
}

function buildWeighInMutations({ adminToken, registrationId, weighinId }) {
  return [
    ...(registrationId
      ? [
          () =>
            mutation('POST', `${API}/api/weighin`, adminToken, {
              registrationId,
              weightKg: 60,
            }),
          () =>
            mutation('POST', `${API}/api/weighin/preview`, adminToken, {
              registrationId,
              weightKg: 60,
            }),
          () =>
            mutation(
              'POST',
              `${API}/api/weighin/${registrationId}/reconcile-category`,
              adminToken,
              {}
            ),
        ]
      : []),
    ...(weighinId
      ? [
          () =>
            mutation('POST', `${API}/api/weighin/${weighinId}/resolve`, adminToken, {
              decision: 'PASS',
            }),
        ]
      : []),
  ];
}

function buildRegistrationMutations({ coachToken, eventId, athleteId, registrationId }) {
  if (!coachToken) {
    return [];
  }

  return [
    ...(eventId && athleteId
      ? [
          () =>
            mutation('POST', `${API}/api/registrations`, coachToken, {
              eventId,
              athleteId,
            }),
        ]
      : []),
    ...(registrationId
      ? [
          () =>
            mutation('POST', `${API}/api/registrations/${registrationId}/status`, coachToken, {
              status: 'APPROVED',
            }),
          () =>
            mutation('POST', `${API}/api/registrations/${registrationId}/category`, coachToken, {
              categoryId: null,
            }),
        ]
      : []),
  ];
}

function buildUserMutations({ adminToken, userId }) {
  const suffix = `${__VU}-${__ITER}`;

  return [
    () =>
      mutation('POST', `${API}/api/admin/users`, adminToken, {
        email: `admin-created+${suffix}@example.com`,
        password: 'Password123!',
        firstName: 'Admin',
        lastName: 'Created',
        role: 'COACH',
      }),
    ...(userId
      ? [
          () =>
            mutation('PATCH', `${API}/api/admin/users/${userId}`, adminToken, {
              firstName: 'Updated',
            }),
          () =>
            mutation('POST', `${API}/api/admin/users/${userId}/dq`, adminToken, {
              reason: 'k6 test',
              until: null,
            }),
          () =>
            mutation('POST', `${API}/api/admin/users/${userId}/remove-dq`, adminToken, {}),
        ]
      : []),
  ];
}

function buildAthleteMutations({ coachToken, athleteId }) {
  const suffix = `${__VU}-${__ITER}`;

  if (!coachToken) {
    return [];
  }

  return [
    () =>
      mutation('POST', `${API}/api/athletes`, coachToken, {
        firstName: 'K6',
        lastName: `Athlete-${suffix}`,
      }),
    ...(athleteId
      ? [
          () =>
            mutation('POST', `${API}/api/athletes/merge`, coachToken, {
              sourceAthleteId: athleteId,
              targetAthleteId: athleteId,
            }),
        ]
      : []),
  ];
}

function buildClubMutations({ coachToken }) {
  const suffix = `${__VU}-${__ITER}`;

  return coachToken
    ? [
        () =>
          mutation('POST', `${API}/api/clubs`, coachToken, {
            name: `K6 Club ${suffix}`,
          }),
      ]
    : [];
}

function buildRulesetMutations({ adminToken, rulesetId }) {
  const suffix = `${__VU}-${__ITER}`;

  return [
    () =>
      mutation('POST', `${API}/api/rulesets`, adminToken, {
        name: `K6 Ruleset ${suffix}`,
      }),
    ...(rulesetId
      ? [
          () =>
            mutation('PATCH', `${API}/api/rulesets/${rulesetId}/structure`, adminToken, {
              structure: {},
            }),
          () =>
            mutation('POST', `${API}/api/rulesets/${rulesetId}/activate`, adminToken, {}),
        ]
      : []),
  ];
}

function buildIntegrityMutations({ adminToken, eventId }) {
  return eventId
    ? [() => mutation('POST', `${API}/api/integrity/lock`, adminToken, { eventId })]
    : [];
}

function buildExportMutations({ adminToken, eventId, exportId }) {
  return [
    ...(eventId
      ? [
          () =>
            mutation('POST', `${API}/api/exports`, adminToken, {
              eventId,
              types: ['results'],
            }),
        ]
      : []),
    ...(exportId
      ? [() => mutation('GET', `${API}/api/exports/${exportId}/download`, adminToken, null)]
      : []),
  ];
}

function buildPolicyMutations({ adminToken, eventId }) {
  return eventId
    ? [
        () =>
          mutation('PATCH', `${API}/api/event-policies/events/${eventId}`, adminToken, {
            autoAdvanceStages: true,
          }),
      ]
    : [];
}

function buildFormMutations({ adminToken }) {
  return [
    () => mutation('POST', `${API}/api/forms/submissions/1/handled`, adminToken, {}),
  ];
}

function buildContentMutations({ adminToken }) {
  const suffix = `${__VU}-${__ITER}`;

  return [
    () =>
      mutation('POST', `${API}/api/admin/news`, adminToken, {
        title: `K6 News ${suffix}`,
        slug: `k6-news-${suffix}`,
        content: 'Load test post',
      }),
  ];
}

export function buildAdminMutationEndpoints(context) {
  if (!runFlags.mutations || !context.adminToken) {
    return [];
  }

  return [
    ...buildAuthMutations(context),
    ...buildEventMutations(context),
    ...buildDrawMutations(context),
    ...buildFightMutations(context),
    ...buildScheduleMutations(context),
    ...buildWeighInMutations(context),
    ...buildUserMutations(context),
    ...buildRulesetMutations(context),
    ...buildIntegrityMutations(context),
    ...buildExportMutations(context),
    ...buildPolicyMutations(context),
    ...buildFormMutations(context),
    ...buildContentMutations(context),
  ];
}

export function buildCoachMutationEndpoints(context) {
  if (!runFlags.mutations || !context.coachToken) {
    return [];
  }

  return [
    ...buildRegistrationMutations(context),
    ...buildAthleteMutations(context),
    ...buildClubMutations(context),
  ];
}

export function buildMutationEndpoints(context) {
  if (!runFlags.mutations) {
    return [];
  }

  return [
    ...buildAdminMutationEndpoints(context),
    ...buildCoachMutationEndpoints(context),
  ];
}
