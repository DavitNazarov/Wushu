// PROD-1: validate environment configuration ONCE at boot. In production a
// missing/invalid var fails fast with a precise message instead of either
// crashing later at point-of-use or — worse — silently falling back to an
// insecure default (CORS → localhost, non-deterministic public org, weak JWT
// secret). In non-production the same problems are logged as warnings so local
// dev isn't blocked.
export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const errors: string[] = [];
  const warnings: string[] = [];

  const sink = (msg: string) => (isProd ? errors : warnings).push(msg);

  const requireVar = (key: string, validate?: (v: string) => string | null) => {
    const value = process.env[key];
    if (!value || !value.trim()) {
      sink(`${key} is not set`);
      return;
    }
    const problem = validate?.(value);
    if (problem) sink(`${key} ${problem}`);
  };

  // Runtime DB connection (pooled) + migrations/DDL connection (direct, must NOT
  // route DDL through PgBouncer — see the C1/DB10 drift history).
  requireVar('DATABASE_URL');
  requireVar('DIRECT_URL');

  // SEC-10: a short HS256 secret is forgeable.
  requireVar('JWT_SECRET', (v) =>
    v.length < 32 ? 'must be at least 32 characters' : null,
  );

  // CORS must be explicit in prod, otherwise getAllowedCorsOrigins() silently
  // falls back to localhost and blocks the real frontend.
  if (
    !process.env.FRONTEND_URL?.trim() &&
    !process.env.CORS_ALLOWED_ORIGINS?.trim()
  ) {
    sink(
      'FRONTEND_URL or CORS_ALLOWED_ORIGINS must be set (CORS otherwise defaults to localhost)',
    );
  }

  // Public org scoping must be deterministic in prod.
  requireVar('PUBLIC_ORG_SLUG');

  // BOOTSTRAP_SECRET being unset disables the bootstrap-admin endpoint, which is
  // safe once an admin exists — so this is only ever a warning.
  if (isProd && !process.env.BOOTSTRAP_SECRET?.trim()) {
    warnings.push(
      'BOOTSTRAP_SECRET is not set — bootstrap-admin is disabled (fine once an admin exists)',
    );
  }

  if (!isTest) {
    for (const w of warnings) console.warn(`[env] WARNING: ${w}`);
  }

  if (errors.length > 0) {
    console.error('[env] FATAL — invalid environment configuration:');
    for (const e of errors) console.error(`  - ${e}`);
    throw new Error(
      `Invalid environment configuration: ${errors.length} problem(s) (see logs above).`,
    );
  }
}
