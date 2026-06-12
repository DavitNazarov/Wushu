import type { Organisation } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Optional slug of the organisation the public site serves.
 *
 * If it is not configured, prefer the organisation that owns an active admin.
 * This keeps public pages aligned with the admin-created data in local/single
 * federation setups, even when old mock seed organisations still exist.
 *
 * PRODUCTION: always set PUBLIC_ORG_SLUG in deployed environments. Without it
 * the public site serves whichever org has the oldest active admin, which is
 * deterministic but order-dependent — if a second org is ever created the
 * wrong federation can surface. Setting the slug pins the canonical org.
 */
const PUBLIC_ORG_SLUG = process.env.PUBLIC_ORG_SLUG?.trim() || null;

/** Canonical org for all public, unauthenticated reads. */
export async function resolvePublicOrg(
  prisma: PrismaService,
): Promise<Organisation | null> {
  if (PUBLIC_ORG_SLUG) {
    return prisma.organisation.findUnique({
      where: { slug: PUBLIC_ORG_SLUG },
    });
  }

  return (
    (await prisma.organisation.findFirst({
      where: {
        users: {
          some: { role: 'admin', isActive: true, deletedAt: null },
        },
      },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.organisation.findFirst({ orderBy: { createdAt: 'asc' } }))
  );
}
