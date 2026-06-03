import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

// Health endpoints mounted under /api.
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/health — LIVENESS. Constant `{ ok: true }`, no auth, no DB hit:
  // the fact that it responds is the signal. Point the process-up probe here.
  @Get('health')
  getHealth() {
    return { ok: true };
  }

  // GET /api/ready — READINESS (REL-1). Cheap `SELECT 1` so the orchestrator/LB
  // can pull a DB-disconnected instance out of rotation (returns 503) while
  // liveness still confirms the process itself is alive. A short race timeout
  // means a hung connection can't make the probe itself hang.
  @Get('ready')
  async getReady() {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('READY_TIMEOUT')), 2000),
        ),
      ]);
      return { ok: true, db: 'up' };
    } catch {
      throw new HttpException(
        { ok: false, db: 'down', code: 'DATABASE_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
