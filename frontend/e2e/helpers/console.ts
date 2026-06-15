import type { Page, ConsoleMessage } from '@playwright/test';

// Console/page-error sequences that are environment noise, not app bugs.
const IGNORE = [
  /favicon/i,
  /sentry/i, // optional monitoring; absent DSN in dev
  /ResizeObserver loop/i, // benign browser quirk
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /hydrat/i, // dev-only hydration warnings tracked separately, not failures here
  /Warning: .*defaultProps/i,
  /webpack-hmr|hot-update|_next\/static\/webpack/i,
  // Next.js 16 / React 19 dev-only server-component performance instrumentation:
  // redirect-only server components (the Legacy* admin shims) emit a
  // performance.measure() whose start time replays as negative across the
  // redirect boundary, throwing "cannot have a negative time stamp". Harmless
  // (the redirect still works) and absent from production builds. See FINDINGS.
  /'measure' on 'Performance'|cannot have a negative time stamp/i,
];

function isNoise(text: string): boolean {
  return IGNORE.some((re) => re.test(text));
}

export type CollectedErrors = {
  console: string[];
  pageErrors: string[];
  /** Non-2xx/3xx responses for same-origin requests (excludes expected 401/404 probes). */
  badResponses: string[];
};

// Attaches listeners that capture real client-side failures: console.error,
// uncaught exceptions, and 5xx responses. Returns the live collection.
export function collectErrors(page: Page): CollectedErrors {
  const errors: CollectedErrors = {
    console: [],
    pageErrors: [],
    badResponses: [],
  };

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!isNoise(text)) errors.console.push(text);
  });

  page.on('pageerror', (err) => {
    if (!isNoise(err.message)) errors.pageErrors.push(err.message);
  });

  page.on('response', (res) => {
    const status = res.status();
    // 5xx is always a bug. 401/403/404 can be legitimate probes (auth, missing
    // optional data), so they're not auto-failed here.
    if (status >= 500) {
      errors.badResponses.push(`${status} ${res.request().method()} ${res.url()}`);
    }
  });

  return errors;
}

// Human-readable summary for assertion messages.
export function summarize(e: CollectedErrors): string {
  const parts: string[] = [];
  if (e.pageErrors.length) parts.push(`pageerrors:\n  - ${e.pageErrors.join('\n  - ')}`);
  if (e.console.length) parts.push(`console.error:\n  - ${e.console.join('\n  - ')}`);
  if (e.badResponses.length) parts.push(`5xx:\n  - ${e.badResponses.join('\n  - ')}`);
  return parts.join('\n');
}
