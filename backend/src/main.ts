import 'dotenv/config';
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

type CreateAppOptions = {
  httpAdapter?: AbstractHttpAdapter;
  globalPrefix?: string | false;
};

export async function createApp(
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const { httpAdapter, globalPrefix = 'api' } = options;
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

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
