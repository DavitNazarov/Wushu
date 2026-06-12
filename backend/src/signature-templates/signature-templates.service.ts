import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import type { CreateSignatureTemplateInput } from './signature-templates.schemas';

// Org-scoped CRUD for the head-judge signature blocks shown on results
// protocols. Signature images are stored inline (base64 data URL).
@Injectable()
export class SignatureTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Metadata only — the signature blob is omitted to keep the list small.
  list(organisationId: string) {
    return this.prisma.protocolSignatureTemplate.findMany({
      where: { organisationId },
      select: {
        id: true,
        judgeNameEn: true,
        judgeNameKa: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    organisationId: string,
    actorUserId: string,
    input: CreateSignatureTemplateInput,
  ) {
    const created = await this.prisma.protocolSignatureTemplate.create({
      data: {
        organisationId,
        judgeNameEn: input.judgeNameEn,
        judgeNameKa: input.judgeNameKa ?? null,
        signature: input.signature,
      },
      select: {
        id: true,
        judgeNameEn: true,
        judgeNameKa: true,
        createdAt: true,
      },
    });

    // Signature blob deliberately excluded from the audit row (large base64).
    await this.audit.write({
      organisationId,
      actorUserId,
      action: 'SIGNATURE_TEMPLATE_CREATED',
      entityType: 'protocolSignatureTemplate',
      entityId: created.id,
      before: null,
      after: {
        judgeNameEn: created.judgeNameEn,
        judgeNameKa: created.judgeNameKa,
      },
    });

    return created;
  }

  async remove(organisationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.protocolSignatureTemplate.findFirst({
      where: { id, organisationId },
      select: { id: true, judgeNameEn: true, judgeNameKa: true },
    });
    if (!existing) throw new NotFoundException('TEMPLATE_NOT_FOUND');
    await this.prisma.protocolSignatureTemplate.delete({ where: { id } });

    await this.audit.write({
      organisationId,
      actorUserId,
      action: 'SIGNATURE_TEMPLATE_DELETED',
      entityType: 'protocolSignatureTemplate',
      entityId: id,
      before: {
        judgeNameEn: existing.judgeNameEn,
        judgeNameKa: existing.judgeNameKa,
      },
      after: null,
    });

    return { ok: true };
  }

  // Full record incl. the signature image — used by the PDF export only.
  getForExport(organisationId: string, id: string) {
    return this.prisma.protocolSignatureTemplate.findFirst({
      where: { id, organisationId },
      select: { judgeNameEn: true, judgeNameKa: true, signature: true },
    });
  }
}
