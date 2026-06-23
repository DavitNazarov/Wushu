import type { Prisma } from '@prisma/client';
import { isDownstreamFightLocked } from './result-safeguards';

// Copy a decided fight's winner into its next-round slot, inside the caller's
// transaction. Shared by live result propagation (FightsService) and draw-time
// BYE auto-confirmation (DrawService) so the downstream-safety guard applies on
// EVERY path: propagating into an already-started or scored downstream bout
// corrupts it (BF-3). Previously the FightsService copy had this guard and the
// DrawService copy did not.
//
// Idempotent — no-ops when the slot already holds the winner. Returns the next
// fight (freshly updated, found-unchanged, or the locked one), or null when
// there is no next fight (final) or the source data is incomplete.
export async function propagateWinnerToNextFight(
  tx: Prisma.TransactionClient,
  fight: {
    winnerAthleteId: string | null;
    nextFightId: string | null;
    nextFightSlot: 'RED' | 'BLUE' | null;
  },
) {
  if (!fight.winnerAthleteId || !fight.nextFightId || !fight.nextFightSlot) {
    return null;
  }

  const nextFight = await tx.fight.findUnique({
    where: { id: fight.nextFightId },
    include: { timerState: { select: { state: true } } },
  });
  if (!nextFight) return null;

  const isRedSlot = fight.nextFightSlot === 'RED';
  const targetField = isRedSlot ? 'redAthleteId' : 'blueAthleteId';
  const existingAthleteId = isRedSlot
    ? nextFight.redAthleteId
    : nextFight.blueAthleteId;

  if (existingAthleteId === fight.winnerAthleteId) {
    return nextFight;
  }

  // BF-3: never overwrite a downstream slot once that fight has already started
  // or been scored. Leave it for manual review instead of corrupting a
  // live/decided bout.
  if (isDownstreamFightLocked(nextFight)) {
    return nextFight;
  }

  return tx.fight.update({
    where: { id: nextFight.id },
    data: {
      [targetField]: fight.winnerAthleteId,
    },
  });
}
