import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const EXPORT_DIR = '/tmp/wushu-exports';

// How long a generated JSON export stays downloadable. Exports are cheap to
// regenerate from the DB, so 72h is generous — the point is that the directory
// (and the DocumentLink rows behind /api/exports/* URLs) cannot grow forever
// and fill the single VPS disk.
const EXPORT_TTL_MS = 72 * 60 * 60 * 1000;

// Daily sweep of /tmp/wushu-exports + the matching DocumentLink rows.
// Mirrors RefreshTokenCleanupService: in-process @Cron, single instance only.
@Injectable()
export class ExportsCleanupService {
  private readonly logger = new Logger(ExportsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 3 * * *')
  async handleCron(): Promise<void> {
    const cutoff = new Date(Date.now() - EXPORT_TTL_MS);

    let removedFiles = 0;
    try {
      const entries = await readdir(EXPORT_DIR);
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const filePath = join(EXPORT_DIR, entry);
        try {
          const info = await stat(filePath);
          if (info.mtime < cutoff) {
            await unlink(filePath);
            removedFiles++;
          }
        } catch {
          // File vanished between readdir and stat/unlink — fine.
        }
      }
    } catch (err) {
      // ENOENT = no exports generated yet on this boot; anything else is worth a log.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        this.logger.warn(
          `Export directory sweep failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Expired DocumentLink rows point at files the sweep above (or a redeploy —
    // /tmp does not survive container restarts) has already removed.
    const removedLinks = await this.prisma.documentLink.deleteMany({
      where: {
        url: { startsWith: '/api/exports/' },
        createdAt: { lt: cutoff },
      },
    });

    if (removedFiles > 0 || removedLinks.count > 0) {
      this.logger.log(
        `Export cleanup removed ${removedFiles} file(s) and ${removedLinks.count} link row(s)`,
      );
    }
  }
}
