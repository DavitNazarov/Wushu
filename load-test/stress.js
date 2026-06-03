// STRESS — ramp the arrival rate well beyond peak to find the breaking point.
//
// The goal is OBSERVATION, not a pass/fail: push until latency climbs and the
// `errors` rate (real failures, 429 excluded) starts rising, then note the knee.
// Watch the k6 output for:
//   • "Insufficient VUs" warnings  → the open model can't keep up = saturation.
//   • errors climbing off zero      → the server is shedding load with 5xx, not 429.
//   • http_req_duration p95/p99 hockey-sticking → queueing / DB contention.
//
//   STRESS_MAX_RATE = iterations/sec at the top of the ramp (default 200).
//
//   Best run RAISED (THROTTLE_DISABLED=1) so you measure the server, not the limiter:
//   THROTTLE_DISABLED=1 npm run dev:backend   # in another terminal
//   k6 run -e STRESS_MAX_RATE=200 load-test/stress.js
//
import { discover, publicBrowsing, coachSession, weighinStation } from './lib/common.js';

export { publicBrowsing, coachSession, weighinStation };

export function setup() {
  return discover();
}

const MAX = Number(__ENV.STRESS_MAX_RATE || 200);
const pub = Math.max(2, Math.ceil(MAX * 0.8));
const coach = Math.max(1, Math.ceil(MAX * 0.12));
const weighin = Math.max(1, Math.ceil(MAX * 0.1));

// Step the rate up in stages so the knee is easy to locate on the timeline.
function climb(top, pre, max, exec) {
  return {
    executor: 'ramping-arrival-rate',
    exec,
    startRate: Math.max(1, Math.ceil(top * 0.1)),
    timeUnit: '1s',
    preAllocatedVUs: pre,
    maxVUs: max,
    stages: [
      { target: Math.ceil(top * 0.25), duration: '1m' },
      { target: Math.ceil(top * 0.5), duration: '1m' },
      { target: Math.ceil(top * 0.75), duration: '1m' },
      { target: top, duration: '2m' }, // hold at the top
      { target: top, duration: '1m' },
      { target: 1, duration: '30s' }, // recover
    ],
  };
}

export const options = {
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    public: climb(pub, 100, 800, 'publicBrowsing'),
    coach: climb(coach, 20, 150, 'coachSession'),
    weighin: climb(weighin, 20, 150, 'weighinStation'),
  },
  // Soft markers, not gates — a "failed" threshold here just flags where it broke.
  thresholds: {
    errors: ['rate<0.25'],
    'http_req_duration{group:public}': ['p(99)<5000'],
    'http_req_duration{group:weighin}': ['p(99)<5000'],
  },
};
