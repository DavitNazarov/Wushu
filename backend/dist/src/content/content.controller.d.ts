import { ContentService } from './content.service';
import { type AuthenticatedRequest } from '../auth/auth.guard';
export declare class ContentController {
    private readonly content;
    constructor(content: ContentService);
    listNews(req: AuthenticatedRequest): Promise<{
        organisationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        title: string;
        body: string;
        publishedAt: Date | null;
    }[]>;
    upsertNews(req: AuthenticatedRequest, body: {
        id?: string;
        title: string;
        slug: string;
        body: string;
        published: boolean;
    }): Promise<{
        organisationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        title: string;
        body: string;
        publishedAt: Date | null;
    }>;
}
