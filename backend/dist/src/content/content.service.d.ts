import type { NewsPost } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
export declare class ContentService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    listNews(organisationId: string): Promise<NewsPost[]>;
    upsertNews(input: {
        organisationId: string;
        actorUserId: string;
        id?: string;
        title: string;
        slug: string;
        body: string;
        published: boolean;
    }): Promise<NewsPost>;
}
