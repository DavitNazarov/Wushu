import Express from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class FormsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    contact(body: {
        name: string;
        email: string;
        message: string;
        clubName?: string | null;
        type: 'contact' | 'membership';
        website?: string | null;
    }, req: Express.Request): Promise<{
        ok: boolean;
    }>;
}
