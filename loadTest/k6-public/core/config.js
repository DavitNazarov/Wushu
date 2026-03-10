import { readEnv } from '../env.js';

export const options = {
  vus: Number(readEnv('VUS', '100')),
  duration: readEnv('DURATION', '10s'),
  thresholds: {
    unexpected_fail_rate: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export const API = readEnv('API_URL', 'http://localhost:4000').replace(
  /\/+$/,
  ''
);
export const EVENT_SLUG = readEnv('EVENT_SLUG', 'georgia');
export const MAT_NAME = readEnv('MAT_NAME', '');

export const credentials = {
  admin: {
    email: readEnv('ADMIN_EMAIL'),
    password: readEnv('ADMIN_PASSWORD'),
  },
  user: {
    email: readEnv('USER_EMAIL'),
    password: readEnv('USER_PASSWORD'),
  },
  coach: {
    email: readEnv('COACH_EMAIL'),
    password: readEnv('COACH_PASSWORD'),
  },
  judge: {
    email: readEnv('JUDGE_EMAIL'),
    password: readEnv('JUDGE_PASSWORD'),
  },
};

export const runFlags = {
  mutations: readEnv('RUN_MUTATIONS', 'false') === 'true',
  destructive: readEnv('RUN_DESTRUCTIVE', 'false') === 'true',
  contactForm: readEnv('RUN_CONTACT_FORM', 'false') === 'true',
};

export const seedIds = {
  eventId: readEnv('EVENT_ID'),
  rulesetId: readEnv('RULESET_ID'),
  userId: readEnv('USER_ID'),
  athleteId: readEnv('ATHLETE_ID'),
  registrationId: readEnv('REGISTRATION_ID'),
  weighinId: readEnv('WEIGHIN_ID'),
  fightId: readEnv('FIGHT_ID'),
  bracketId: readEnv('BRACKET_ID'),
  matId: readEnv('MAT_ID'),
  matName: readEnv('MAT_NAME'),
  eventWeightCategoryId: readEnv('EVENT_WEIGHT_CATEGORY_ID'),
  exportId: readEnv('EXPORT_ID'),
  newsSlug: readEnv('NEWS_SLUG'),
  publicBracketCategoryId: readEnv('EVENT_WEIGHT_CATEGORY_ID'),
};

export const jsonHeaders = {
  'Content-Type': 'application/json',
};
