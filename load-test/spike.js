// SPIKE — a sudden burst on top of a calm baseline, then back to calm.
//
// Models the "a marquee fight just went LIVE and everyone refreshes at once"
// moment. We care about two things:
//   1. Does the server survive the burst without 5xx / crash (errors stays low)?
//   2. Does it RECOVER — latency + errors return to baseline after the spike?
//
// The spike is weighted toward PUBLIC traffic (spectators), with the weigh-in
// station kept steady (operators don't suddenly 50× their actions).
//
//   SPIKE_RATE = iterations/sec at the apex (default 200; each iteration is a
//   multi-request session, so the apex is ~600 req/s). Bump it with -e if your
//   test host has the headroom — watch for k6 "insufficient VUs" warnings, which
//   mean k6 (not the server) is the bottleneck.
//
//   k6 run -e SPIKE_RATE=200 load-test/spike.js
//   (run RAISED to see true burst capacity; run LIMITED to see the limiter clamp it.)
//
import { discover, publicBrowsing, coachSession, weighinStation } from './lib/common.js';

export { publicBrowsing, coachSession, weighinStation };

export function setup() {
  return discover();
}

const SPIKE = Number(__ENV.SPIKE_RATE || 200);

export const options = {
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    // Public: calm → violent spike → calm → recovery hold.
    public: {
      executor: 'ramping-arrival-rate',
      exec: 'publicBrowsing',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 5, duration: '30s' }, // baseline
        { target: SPIKE, duration: '10s' }, // sharp ramp UP
        { target: SPIKE, duration: '45s' }, // hold the burst
        { target: 5, duration: '10s' }, // sharp ramp DOWN
        { target: 5, duration: '1m30s' }, // recovery window — watch it settle
      ],
    },
    // Coaches: a small bump (they check the stream too).
    coach: {
      executor: 'ramping-arrival-rate',
      exec: 'coachSession',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 150,
      stages: [
        { target: 2, duration: '30s' },
        { target: Math.max(5, Math.ceil(SPIKE * 0.1)), duration: '10s' },
        { target: Math.max(5, Math.ceil(SPIKE * 0.1)), duration: '45s' },
        { target: 2, duration: '10s' },
        { target: 2, duration: '1m30s' },
      ],
    },
    // Weigh-in station: steady throughout (the burst shouldn't change their pace).
    weighin: {
      executor: 'constant-arrival-rate',
      exec: 'weighinStation',
      rate: 3,
      timeUnit: '1s',
      duration: '3m5s',
      preAllocatedVUs: 15,
      maxVUs: 80,
    },
  },
  thresholds: {
    errors: ['rate<0.1'],
    'http_req_duration{group:public}': ['p(95)<3000'],
    // Weigh-in is the operational path — it must stay usable even during a spectator spike.
    'http_req_duration{group:weighin}': ['p(95)<2000'],
  },
};
