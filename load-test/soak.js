// SOAK — moderate, steady load held for a long time to surface slow problems:
// memory leaks, connection-pool exhaustion, growing GC pauses, latency drift.
//
// Watch for METRICS THAT DRIFT over time even though the rate is flat — that's
// the soak signal (a single snapshot looks fine; the trend is the bug).
//
//   SOAK_RATE     = iterations/sec, held flat (default 15)
//   SOAK_DURATION = how long to hold (default 30m)
//
// IMPORTANT: run SOAK in the RAISED mode (THROTTLE_DISABLED=1). Two reasons:
//   1. The 15-min access token expires mid-soak; VUs re-login on 401, but the
//      login route is throttled in limited mode and would 429 the re-login.
//   2. A flat single-IP rate above ~2/s is otherwise all 429s in limited mode.
//
//   THROTTLE_DISABLED=1 npm run dev:backend        # in another terminal
//   k6 run -e SOAK_RATE=15 -e SOAK_DURATION=30m load-test/soak.js
//
import { discover, publicBrowsing, coachSession, weighinStation } from './lib/common.js';

export { publicBrowsing, coachSession, weighinStation };

export function setup() {
  return discover();
}

const RATE = Number(__ENV.SOAK_RATE || 15);
const DURATION = __ENV.SOAK_DURATION || '30m';
const pub = Math.max(1, Math.ceil(RATE * 0.8));
const coach = Math.max(1, Math.ceil(RATE * 0.12));
const weighin = Math.max(1, Math.ceil(RATE * 0.1));

function steady(rate, pre, max, exec) {
  return {
    executor: 'constant-arrival-rate',
    exec,
    rate,
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: pre,
    maxVUs: max,
  };
}

export const options = {
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    public: steady(pub, 40, 200, 'publicBrowsing'),
    coach: steady(coach, 10, 60, 'coachSession'),
    weighin: steady(weighin, 10, 60, 'weighinStation'),
  },
  thresholds: {
    // Over a long flat run, real errors must stay near zero AND not trend up.
    errors: ['rate<0.02'],
    checks: ['rate>0.97'],
    'http_req_duration{group:public}': ['p(95)<1200'],
    'http_req_duration{group:weighin}': ['p(95)<1500'],
  },
};
