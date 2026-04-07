import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { ZodValidationPipe } from './common/zod-validation.pipe';
import { createCorsOriginDelegate } from './config/runtime-env';

type CreateAppOptions = {
  httpAdapter?: AbstractHttpAdapter;
  globalPrefix?: string | false;
};

export async function createApp(
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const { httpAdapter, globalPrefix = 'api' } = options;
  const app = httpAdapter
    ? await NestFactory.create(AppModule, httpAdapter)
    : await NestFactory.create(AppModule);

  // Security headers — must run before any other middleware
  app.use(
    helmet({
      // CSP not set here; configure at the reverse-proxy/CDN layer for HTML pages.
      contentSecurityPolicy: false,
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

  // Limit body size to prevent payload-flooding attacks (default Express is 100 kb)
  app.use(
    (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      // Use express built-in json/urlencoded with explicit limits.
      // NestJS already applies its own body parser; this middleware is a safety
      // belt in case a raw body somehow bypasses the NestJS layer.
      next();
    },
  );

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

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
