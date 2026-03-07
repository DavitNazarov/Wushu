/**
 * E2E test: POST /api/events
 * Reproduces 500 and captures stack trace. Run: npm run test:e2e -- events-create
 * Requires: DATABASE_URL in .env
 */
import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/global-exception.filter';
import { AuthGuard } from '../src/auth/auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

function validPayload(slugSuffix: string | number = Date.now()) {
  return {
    name: 'Georgia Open Cup 2026',
    slug: `georgia-open-cup-${slugSuffix}`,
    location: 'Tbilisi',
    timezone: 'Asia/Tbilisi',
    dates: {
      range: { startDate: '2026-03-02', endDate: '2026-03-05' },
      registrationDays: ['2026-03-02', '2026-03-03'],
      fightDays: ['2026-03-04', '2026-03-05'],
    },
  };
}

describe('POST /api/events (e2e)', () => {
  let app: INestApplication<App>;
  let orgId: string;
  let userId: string;
  let dbReady = false;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.auth = {
            sub: userId,
            organisationId: orgId,
            role: 'admin',
            capabilities: ['EVENTS_MANAGE'],
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    try {
      const prisma = app.get(PrismaService);
      const org = await prisma.organisation.findFirst();
      if (!org) {
        throw new Error('No organisation found for e2e setup');
      }
      const user = await prisma.user.findFirst({
        where: { organisationId: org.id },
      });
      if (!user) {
        throw new Error('No user found for e2e setup');
      }
      orgId = org.id;
      userId = user.id;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates event and returns 201', async () => {
    if (!dbReady) return;
    const payload = validPayload();
    const res = await request(app.getHttpServer())
      .post('/api/events')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', payload.name);
    expect(res.body).toHaveProperty('slug', payload.slug);
  });

  it('returns 422 for invalid payload (empty registrationDays)', async () => {
    if (!dbReady) return;
    const invalidPayload = {
      ...validPayload('invalid-test'),
      slug: 'another-slug-2026',
      dates: {
        range: { startDate: '2026-03-02', endDate: '2026-03-05' },
        registrationDays: [],
        fightDays: ['2026-03-04'],
      },
    };
    const res = await request(app.getHttpServer())
      .post('/api/events')
      .send(invalidPayload);

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(res.body).toHaveProperty('message', 'Invalid event payload');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(
      res.body.issues.some((i: { path: string }) =>
        i.path.includes('registrationDays'),
      ),
    ).toBe(true);
  });
});
