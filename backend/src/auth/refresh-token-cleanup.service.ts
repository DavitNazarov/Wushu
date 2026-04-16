import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async handleCron(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          {
            revokedAt: {
              not: null,
              lt: cutoff,
            },
          },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleanup removed ${result.count} old refresh tokens`);
    }
  }
}

