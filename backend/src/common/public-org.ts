import type { Organisation } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Slug of the organisation the public site serves.
 *
 * The app is effectively single-federation, but multiple Organisation rows
 * can exist (the auth-bootstrap 'default' org from the first admin login plus
 * the seeded federation org). Public reads must therefore resolve THE org
 * deterministically — `organisation.findFirst()` has no ORDER BY and returns
 * an arbitrary row, which silently shows the wrong (often empty) org after a
 * restore or once a second org exists.
 */
export const PUBLIC_ORG_SLUG =
  process.env.PUBLIC_ORG_SLUG ?? 'georgian-wushu-federation';

/** Canonical org for all public, unauthenticated reads. */
export async function resolvePublicOrg(
  prisma: PrismaService,
): Promise<Organisation | null> {
  return (
    (await prisma.organisation.findUnique({
      where: { slug: PUBLIC_ORG_SLUG },
    })) ??
    // Deterministic fallback: oldest org, never a random row.
    (await prisma.organisation.findFirst({ orderBy: { createdAt: 'asc' } }))
  );
}
