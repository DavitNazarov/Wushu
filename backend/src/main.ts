import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { ZodValidationPipe } from './common/zod-validation.pipe';

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
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
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
  await app.listen(process.env.PORT ?? 4000);
}

if (require.main === module) {
  void bootstrap();
}
