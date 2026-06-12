import 'dotenv/config';
import * as Sentry from '@sentry/node';

// Backend error aggregation (H5): initialise as early as possible, gated on
// SENTRY_DSN — without the var this whole block is a no-op and the SDK stays
// dormant (same pattern as the frontend's NEXT_PUBLIC_SENTRY_DSN gate).
if (process.env.SENTRY_DSN?.trim()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Errors only — no performance tracing on the single-instance server.
    tracesSampleRate: 0,
  });
}

import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { ZodValidationPipe } from './common/zod-validation.pipe';
import { createCorsOriginDelegate } from './config/runtime-env';
import { validateEnv } from './config/validate-env';

// Options accepted by createApp(). Both fields are optional and exist mainly
// so e2e tests can inject a custom HTTP adapter or disable the `/api` prefix.
type CreateAppOptions = {
  httpAdapter?: AbstractHttpAdapter;
  globalPrefix?: string | false;
};

// Factory that builds a fully wired Nest application instance.
// Split out from bootstrap() so e2e tests (test/*.e2e-spec.ts) can call it
// without going through `app.listen()`. Responsibilities, in order:
//   1. Instantiate the Nest app (optionally with a custom http adapter)
//   2. Apply security middleware (Helmet, CSP, body-size cap)
//   3. Configure trust-proxy in production so client IPs are correct
//   4. Wire cookie parsing + CORS using runtime-env's origin allow-list
//   5. Register the global `/api` route prefix
//   6. Install the Zod validation pipe and the global exception filter
export async function createApp(
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const { httpAdapter, globalPrefix = 'api' } = options;
  // PROD-1: fail fast on a misconfigured production environment before wiring
  // anything up (in dev/test this only logs warnings).
  validateEnv();
  // bodyParser is disabled here because we re-register express.json/urlencoded
  // below with a hard 100 KB cap. Letting Nest install its own parser would
  // bypass that cap and re-enable Nest's default 1 MB limit.
  const app = httpAdapter
    ? await NestFactory.create(AppModule, httpAdapter, { bodyParser: false })
    : await NestFactory.create(AppModule, { bodyParser: false });

  // Security headers — must run before any other middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Trust the immediate upstream proxy (e.g. Nginx/Caddy) so that
  // req.ip / X-Forwarded-For are accurate for rate-limit keys and audit logs.
  if (process.env.NODE_ENV === 'production') {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    expressApp.set('trust proxy', 1);
  }

  // Limit body size to prevent payload-flooding attacks
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: true }));

  app.use(cookieParser());
  app.enableCors({
    origin: createCorsOriginDelegate(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  return app;
}

// Production/dev entry point. Constructs the app via createApp() and binds it
// to 0.0.0.0:$PORT (defaulting to 4000) so Railway/Docker can reach it from
// outside the container. Not invoked from tests — see the `require.main` guard.
async function bootstrap() {
  const app = await createApp();
  // REL-2: on SIGTERM/SIGINT (deploy, restart, scale-down) Nest will run module
  // shutdown hooks — PrismaService.onModuleDestroy closes the DB pool and the
  // @nestjs/schedule timer interval is cleared — instead of abruptly dropping
  // in-flight requests and connections mid-event.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}

// Only call bootstrap() when this file is executed directly (e.g. `node dist/main.js`).
// When imported by tests or by server.js, createApp() is used instead so the caller
// controls the listen lifecycle.
if (require.main === module) {
  void bootstrap();
}
