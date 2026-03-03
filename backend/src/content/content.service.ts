import type { NewsPost, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listNews(organisationId: string): Promise<NewsPost[]> {
    return this.prisma.newsPost.findMany({
      where: { organisationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertNews(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    title: string;
    slug: string;
    body: string;
    published: boolean;
  }): Promise<NewsPost> {
    const existing = input.id
      ? await this.prisma.newsPost.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const data = {
        organisationId: input.organisationId,
        title: input.title,
        slug: input.slug,
        body: input.body,
        publishedAt: input.published ? (existing?.publishedAt ?? new Date()) : null,
      };

      const post = existing
        ? await tx.newsPost.update({ where: { id: existing.id }, data })
        : await tx.newsPost.create({ data });

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: existing ? 'NEWS_UPDATED' : 'NEWS_CREATED',
        entityType: 'news_post',
        entityId: post.id,
        before: existing as unknown as Prisma.JsonValue | null,
        after: post as unknown as Prisma.JsonValue,
        reason: null,
        ipAddress: null,
      });

      return post;
    });
  }
}
