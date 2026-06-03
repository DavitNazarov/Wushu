// Rate-limit knobs, read from the environment once at module load.
//
// Production behaviour is unchanged: when no THROTTLE_* vars are set, every
// value below resolves to the same literal that used to be hard-coded in
// app.module.ts / auth.controller.ts (default 120/60s, short 10/10s,
// login 5/60s, refresh 20/60s, bootstrap 3/60s).
//
// The knobs exist so load tests can run in two modes against the same build:
//   - "limited"  — defaults, to verify the limiter actually protects the API
//                  (and to surface the shared-NAT 429 risk for spectators).
//   - "raised"   — THROTTLE_DISABLED=1, to measure the server/DB's true
//                  ceiling without the limiter masking it.
// THROTTLE_DISABLED is a load-testing escape hatch only — never set it in prod.

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DISABLED = process.env.THROTTLE_DISABLED === '1';

// Effectively-unlimited ceiling used when THROTTLE_DISABLED=1. Large enough
// that no load profile will reach it, but still a finite number so the
// ThrottlerGuard machinery keeps working unchanged.
const UNLIMITED = 100_000_000;

export const THROTTLE = {
  defaultTtl: num(process.env.THROTTLE_DEFAULT_TTL_MS, 60_000),
  defaultLimit: DISABLED
    ? UNLIMITED
    : num(process.env.THROTTLE_DEFAULT_LIMIT, 120),
  shortTtl: num(process.env.THROTTLE_SHORT_TTL_MS, 10_000),
  shortLimit: DISABLED ? UNLIMITED : num(process.env.THROTTLE_SHORT_LIMIT, 10),
  loginLimit: DISABLED ? UNLIMITED : num(process.env.THROTTLE_LOGIN_LIMIT, 5),
  loginTtl: num(process.env.THROTTLE_LOGIN_TTL_MS, 60_000),
  refreshLimit: DISABLED
    ? UNLIMITED
    : num(process.env.THROTTLE_REFRESH_LIMIT, 20),
  refreshTtl: num(process.env.THROTTLE_REFRESH_TTL_MS, 60_000),
  bootstrapLimit: DISABLED
    ? UNLIMITED
    : num(process.env.THROTTLE_BOOTSTRAP_LIMIT, 3),
  bootstrapTtl: num(process.env.THROTTLE_BOOTSTRAP_TTL_MS, 60_000),
} as const;
