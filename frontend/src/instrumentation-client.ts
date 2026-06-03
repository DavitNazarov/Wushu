import * as Sentry from '@sentry/nextjs';
import { sentryEnabled, sharedSentryOptions } from './sentry.shared.config';

if (sentryEnabled) {
  Sentry.init(sharedSentryOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
