"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/audit.service");
let ContentService = class ContentService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async listNews(organisationId) {
        return this.prisma.newsPost.findMany({
            where: { organisationId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async upsertNews(input) {
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
                before: existing,
                after: post,
                reason: null,
                ipAddress: null,
            });
            return post;
        });
    }
};
exports.ContentService = ContentService;
exports.ContentService = ContentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ContentService);
//# sourceMappingURL=content.service.js.map