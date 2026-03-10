import { API, EVENT_SLUG, MAT_NAME, credentials, seedIds } from '../core/config.js';
import { login, requireLogin } from '../core/auth.js';
import {
  getJson,
  maybeId,
  maybeSlug,
  toList,
} from '../core/helpers.js';
import { STATUS_POLICIES } from '../core/policies.js';
import { get } from '../core/request.js';

const adminDiscoveryPaths = [
  ['rulesetId', '/api/rulesets'],
  ['userId', '/api/admin/users'],
  ['registrationId', '/api/registrations'],
  ['athleteId', '/api/athletes'],
];

function fetchJson(path, token = '', allowedStatuses = STATUS_POLICIES.publicRead) {
  const response = get(`${API}${path}`, {
    token,
    tagName: `GET ${path}`,
    allowedStatuses,
  });
  return getJson(response, null);
}

function fetchList(path, token = '', allowedStatuses = STATUS_POLICIES.publicRead) {
  return toList(fetchJson(path, token, allowedStatuses) ?? []);
}

function discoverPublicEventId(currentEventId) {
  if (currentEventId) {
    return currentEventId;
  }

  const events = fetchList('/api/public/events');
  const event =
    events.find((item) => maybeSlug(item) === EVENT_SLUG) || events[0] || null;

  return maybeId(event);
}

function discoverAdminEventId(currentEventId, token) {
  if (currentEventId || !token) {
    return currentEventId;
  }

  const events = fetchList('/api/events', token, STATUS_POLICIES.authenticatedRead);
  const event =
    events.find((item) => maybeSlug(item) === EVENT_SLUG) || events[0] || null;

  return maybeId(event);
}

function discoverNewsSlug(currentNewsSlug) {
  if (currentNewsSlug) {
    return currentNewsSlug;
  }

  const news = fetchList('/api/public/news');
  return maybeSlug(news[0]);
}

function discoverPublicBracketCategoryId(currentCategoryId) {
  if (currentCategoryId) {
    return currentCategoryId;
  }

  const overview = fetchJson(
    `/api/public/brackets/overview?eventSlug=${encodeURIComponent(EVENT_SLUG)}`
  );
  const firstCategory = toList(overview?.categories)[0];

  return maybeId(firstCategory) || firstCategory?.eventWeightCategoryId || '';
}

function discoverPublicMatName(currentMatName) {
  if (currentMatName) {
    return currentMatName;
  }

  const live = fetchJson(`/api/public/live?eventSlug=${encodeURIComponent(EVENT_SLUG)}`);

  return live?.selectedMatName || live?.mats?.[0]?.name || '';
}

function discoverFirstId(currentId, path, token) {
  if (currentId || !token) {
    return currentId;
  }

  const list = fetchList(path, token, STATUS_POLICIES.authenticatedRead);
  return maybeId(list[0]);
}

function discoverAdminEventWeightCategoryId(currentId, token, eventId) {
  if (currentId || !token || !eventId) {
    return currentId;
  }

  const overview = fetchJson(
    `/api/draw/overview?eventId=${encodeURIComponent(eventId)}`,
    token,
    STATUS_POLICIES.authenticatedRead
  );
  const firstCategory = toList(overview?.categories)[0];

  return maybeId(firstCategory) || '';
}

function discoverAdminBracketId(currentId, token, eventId) {
  if (currentId || !token || !eventId) {
    return currentId;
  }

  const brackets = fetchList(
    `/api/brackets?eventId=${encodeURIComponent(eventId)}`,
    token,
    STATUS_POLICIES.authenticatedRead
  );

  return maybeId(brackets[0]);
}

function discoverAdminFightId(currentId, token, eventId, matId = '') {
  if (currentId || !token) {
    return currentId;
  }

  const query = new URLSearchParams();
  if (eventId) {
    query.set('eventId', eventId);
  }
  if (matId) {
    query.set('matId', matId);
  }

  const path = query.size ? `/api/fights?${query.toString()}` : '/api/fights';
  const fights = fetchList(path, token, STATUS_POLICIES.authenticatedRead);

  return maybeId(fights[0]);
}

function discoverAdminMat(currentMatId, currentMatName, token, eventId) {
  if ((!currentMatId && !currentMatName) && (!token || !eventId)) {
    return { matId: currentMatId, matName: currentMatName };
  }

  if (currentMatId && currentMatName) {
    return { matId: currentMatId, matName: currentMatName };
  }

  const mats = fetchList(
    `/api/mats?eventId=${encodeURIComponent(eventId)}`,
    token,
    STATUS_POLICIES.authenticatedRead
  );
  const firstMat = mats[0] ?? null;

  return {
    matId: currentMatId || maybeId(firstMat),
    matName: currentMatName || firstMat?.name || '',
  };
}

function discoverAdminWeighinId(currentId, token, eventId) {
  if (currentId || !token || !eventId) {
    return currentId;
  }

  const attempts = fetchList(
    `/api/weighin?eventId=${encodeURIComponent(eventId)}`,
    token,
    STATUS_POLICIES.authenticatedRead
  );

  return maybeId(attempts[0]);
}

export function createSetup(enabledRoles = {}) {
  const roles = {
    admin: enabledRoles.admin ?? true,
    user: enabledRoles.user ?? true,
    coach: enabledRoles.coach ?? true,
    judge: enabledRoles.judge ?? true,
  };
  const discovery = {
    publicEventId: enabledRoles.discoverPublicEventId ?? false,
    adminEventId: enabledRoles.discoverAdminEventId ?? false,
    publicNewsSlug: enabledRoles.discoverPublicNewsSlug ?? false,
    publicBracketCategoryId: enabledRoles.discoverPublicBracketCategoryId ?? false,
    publicMatName: enabledRoles.discoverPublicMatName ?? false,
    adminIds: enabledRoles.discoverAdminIds ?? false,
  };
  const requiredRoles = {
    admin: enabledRoles.requireAdmin ?? false,
    user: enabledRoles.requireUser ?? false,
    coach: enabledRoles.requireCoach ?? false,
    judge: enabledRoles.requireJudge ?? false,
  };

  return function setup() {
    const adminToken = roles.admin
      ? requiredRoles.admin
        ? requireLogin('admin', credentials.admin.email, credentials.admin.password)
        : login(credentials.admin.email, credentials.admin.password)
      : '';
    const userToken = roles.user
      ? requiredRoles.user
        ? requireLogin('user', credentials.user.email, credentials.user.password)
        : login(credentials.user.email, credentials.user.password)
      : '';
    const coachToken = roles.coach
      ? requiredRoles.coach
        ? requireLogin('coach', credentials.coach.email, credentials.coach.password)
        : login(credentials.coach.email, credentials.coach.password)
      : '';
    const judgeToken = roles.judge
      ? requiredRoles.judge
        ? requireLogin('judge', credentials.judge.email, credentials.judge.password)
        : login(credentials.judge.email, credentials.judge.password)
      : '';

    const discoveredIds = { ...seedIds };
    const publicContext = {
      newsSlug: discoveredIds.newsSlug,
      publicBracketCategoryId: discoveredIds.publicBracketCategoryId || '',
      publicMatName: discoveredIds.matName || MAT_NAME,
    };

    if (discovery.publicEventId) {
      discoveredIds.eventId = discoverPublicEventId(discoveredIds.eventId);
    }

    if (discovery.adminEventId) {
      discoveredIds.eventId = discoverAdminEventId(discoveredIds.eventId, adminToken);
    }

    if (discovery.publicNewsSlug) {
      publicContext.newsSlug = discoverNewsSlug(publicContext.newsSlug);
      discoveredIds.newsSlug = publicContext.newsSlug;
    }

    if (discovery.publicBracketCategoryId) {
      publicContext.publicBracketCategoryId = discoverPublicBracketCategoryId(
        publicContext.publicBracketCategoryId
      );
    }

    if (discovery.publicMatName) {
      publicContext.publicMatName = discoverPublicMatName(publicContext.publicMatName);
    }

    if (enabledRoles.requireEventId && !discoveredIds.eventId) {
      throw new Error(`Required event ID could not be discovered for event slug "${EVENT_SLUG}"`);
    }

    if (discovery.adminIds && adminToken) {
      for (const [key, path] of adminDiscoveryPaths) {
        discoveredIds[key] = discoverFirstId(discoveredIds[key], path, adminToken);
      }

      discoveredIds.eventWeightCategoryId = discoverAdminEventWeightCategoryId(
        discoveredIds.eventWeightCategoryId,
        adminToken,
        discoveredIds.eventId
      );

      const adminMat = discoverAdminMat(
        discoveredIds.matId,
        discoveredIds.matName,
        adminToken,
        discoveredIds.eventId
      );
      discoveredIds.matId = adminMat.matId;
      discoveredIds.matName = adminMat.matName;

      discoveredIds.fightId = discoverAdminFightId(
        discoveredIds.fightId,
        adminToken,
        discoveredIds.eventId,
        discoveredIds.matId
      );
      discoveredIds.bracketId = discoverAdminBracketId(
        discoveredIds.bracketId,
        adminToken,
        discoveredIds.eventId
      );
      discoveredIds.weighinId = discoverAdminWeighinId(
        discoveredIds.weighinId,
        adminToken,
        discoveredIds.eventId
      );
    }

    if (enabledRoles.requireAdminIds) {
      const missingKeys = ['rulesetId', 'userId', 'fightId', 'bracketId'].filter(
        (key) => !discoveredIds[key]
      );

      if (missingKeys.length) {
        throw new Error(`Required admin IDs missing: ${missingKeys.join(', ')}`);
      }
    }

    return {
      adminToken,
      userToken,
      coachToken,
      judgeToken,
      ...publicContext,
      ...discoveredIds,
    };
  };
}

export const setup = createSetup();
