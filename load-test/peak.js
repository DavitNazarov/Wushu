// PEAK — realistic tournament-day peak load, sustained.
//
// Open model (arrival-rate): we fix the request ARRIVAL rate independent of how
// fast the server responds, then watch latency + errors. Traffic mix mirrors a
// real event: spectators dominate, a handful of coaches, a few weigh-in stations.
//
//   PEAK_RATE = iterations/sec at the plateau (default 30). Each iteration is a
//   multi-request "session", so actual req/s ≈ 3-4× this.
//
//   k6 run -e PEAK_RATE=30 load-test/peak.js
//
// NOTE on the two run modes:
//   • limited (default backend): all k6 traffic comes from ONE IP, so the
//     per-IP limiter (120/min) will 429 most requests. That is the POINT — it
//     shows spectators behind a shared NAT get throttled. `errors` excludes 429,
//     so it still catches real 5xx/crash failures; latency p95 looks artificially
//     low because 429s return instantly.
//   • raised (THROTTLE_DISABLED=1): measures the server/DB's true ceiling.
//
import { discover, publicBrowsing, coachSession, weighinStation } from './lib/common.js';

export { publicBrowsing, coachSession, weighinStation };

export function setup() {
  return discover();
}

const PEAK = Number(__ENV.PEAK_RATE || 30);
const pub = Math.max(1, Math.ceil(PEAK * 0.8)); // ~80% spectators
const coach = Math.max(1, Math.ceil(PEAK * 0.12)); // ~12% coaches
const weighin = Math.max(1, Math.ceil(PEAK * 0.1)); // ~10% weigh-in stations

function ramp(target, pre, max, exec) {
  return {
    executor: 'ramping-arrival-rate',
    exec,
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs: pre,
    maxVUs: max,
    stages: [
      { target, duration: '1m' }, // ramp up
      { target, duration: '4m' }, // hold the plateau
      { target: 1, duration: '30s' }, // ramp down
    ],
  };
}

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    public: ramp(pub, 50, 400, 'publicBrowsing'),
    coach: ramp(coach, 10, 80, 'coachSession'),
    weighin: ramp(weighin, 10, 80, 'weighinStation'),
  },
  thresholds: {
    // Real failures (5xx / network / unexpected 4xx) must stay rare. Excludes 429.
    errors: ['rate<0.02'],
    checks: ['rate>0.95'],
    // Latency budgets per category (meaningful in the RAISED run).
    'http_req_duration{group:public}': ['p(95)<1000'],
    'http_req_duration{group:coach}': ['p(95)<1200'],
    'http_req_duration{group:weighin}': ['p(95)<1500'],
  },
};
