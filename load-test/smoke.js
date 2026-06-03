// SMOKE — sanity check that all three traffic categories work end-to-end at
// trivial load. Run this FIRST after provisioning; if it isn't green, the
// heavier profiles are meaningless. Low enough rate that the rate-limiter never
// trips, so http_req_failed should be ~0 even in a "limited" run.
//
//   k6 run load-test/smoke.js
//
import { discover, publicBrowsing, coachSession, weighinStation } from './lib/common.js';

// Re-export so k6 can resolve the per-scenario `exec` targets.
export { publicBrowsing, coachSession, weighinStation };

export function setup() {
  return discover();
}

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    public: { executor: 'constant-vus', vus: 2, duration: '30s', exec: 'publicBrowsing' },
    coach: { executor: 'constant-vus', vus: 1, duration: '30s', exec: 'coachSession' },
    weighin: { executor: 'constant-vus', vus: 1, duration: '30s', exec: 'weighinStation' },
  },
  thresholds: {
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.05'], // at smoke load nothing should be throttled or fail
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};
