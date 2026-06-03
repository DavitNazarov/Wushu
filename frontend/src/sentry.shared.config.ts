import * as Sentry from '@sentry/nextjs';

// @sentry/nextjs (v10) does not re-export an `Options` type — it only appears
// inside the exported init()'s parameter signature. Derive the options type
// straight from init() so this stays correct regardless of SDK version.
type SentryOptions = Parameters<typeof Sentry.init>[0];

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

export const sharedSentryOptions: SentryOptions = {
  dsn,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,
};
