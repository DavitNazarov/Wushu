import type { LiveQueueFightRow, LiveSessionSummary } from '@/types/live';

/** Show the "wrap-up" warning once a session has this many playable fights left. */
export const SESSION_WRAP_UP_THRESHOLD = 5;

export type LiveSessionGroup = {
  id: string | null;
  name: string | null;
  order: number;
  fights: LiveQueueFightRow[];
  total: number;
  done: number;
  remaining: number;
  isFinished: boolean;
  isActive: boolean;
};

export function isLiveFightFinished(fight: LiveQueueFightRow): boolean {
  return (
    fight.liveStatus === 'FINISHED' ||
    fight.status === 'COMPLETE' ||
    fight.status === 'CONFIRMED'
  );
}

const isFinished = isLiveFightFinished;

/**
 * Group the full queue (already in play order) by schedule session, keeping the
 * session order from the board. Fights with no session land in a trailing
 * "unassigned" group (id `null`).
 */
export function groupFightsBySession(
  allFights: LiveQueueFightRow[],
  sessions: LiveSessionSummary[],
  currentFightId: string | null,
): LiveSessionGroup[] {
  const byId = new Map<string | null, LiveSessionGroup>();

  const ensure = (
    id: string | null,
    name: string | null,
    order: number,
  ): LiveSessionGroup => {
    let group = byId.get(id);
    if (!group) {
      group = {
        id,
        name,
        order,
        fights: [],
        total: 0,
        done: 0,
        remaining: 0,
        isFinished: false,
        isActive: false,
      };
      byId.set(id, group);
    }
    return group;
  };

  // Seed defined sessions first so empty ones keep their slot/order.
  for (const session of sessions) {
    ensure(session.id, session.name, session.order);
  }

  const unassignedOrder = sessions.length
    ? Math.max(...sessions.map((s) => s.order)) + 1
    : 0;

  for (const fight of allFights) {
    const group = ensure(
      fight.sessionId,
      fight.sessionName,
      fight.sessionId ? (fight.sessionOrder ?? 0) : unassignedOrder,
    );
    group.fights.push(fight);
  }

  const groups = [...byId.values()]
    .filter((group) => group.fights.length > 0)
    .sort((a, b) => a.order - b.order);

  for (const group of groups) {
    group.total = group.fights.length;
    group.done = group.fights.filter(isFinished).length;
    group.remaining = group.total - group.done;
    group.isFinished = group.remaining === 0;
    group.isActive = currentFightId
      ? group.fights.some((fight) => fight.id === currentFightId)
      : false;
  }

  return groups;
}

export type LiveSessionBoundary = {
  session: LiveSessionSummary;
  opener: LiveQueueFightRow;
};

/**
 * A "session boundary" is when the previous session is fully finished and the
 * next session's opening fight is queued but not yet touched. The UI shows a
 * "start next session" gate instead of silently rolling into the new block.
 */
export function detectSessionBoundary(
  allFights: LiveQueueFightRow[],
  sessions: LiveSessionSummary[],
  currentFight: LiveQueueFightRow | null,
): LiveSessionBoundary | null {
  if (!currentFight || currentFight.sessionId == null) return null;
  if (currentFight.status !== 'QUEUED' || currentFight.timerState != null) {
    return null;
  }

  const currentOrder = currentFight.sessionOrder;
  if (currentOrder == null) return null;

  const sessionFights = allFights.filter(
    (fight) => fight.sessionId === currentFight.sessionId,
  );
  const opener = sessionFights.reduce<LiveQueueFightRow | null>((min, fight) => {
    if (!min) return fight;
    return (fight.orderInSession ?? 0) < (min.orderInSession ?? 0) ? fight : min;
  }, null);
  if (!opener || opener.id !== currentFight.id) return null;

  // Nothing in this session may have started yet.
  const sessionUntouched = sessionFights.every(
    (fight) => fight.status === 'QUEUED' && fight.timerState == null,
  );
  if (!sessionUntouched) return null;

  // Every fight in an earlier session must be finished, and there must be one.
  const priorFights = allFights.filter(
    (fight) =>
      fight.sessionOrder != null && fight.sessionOrder < currentOrder,
  );
  if (priorFights.length === 0) return null;
  const priorAllDone = priorFights.every(
    (fight) =>
      fight.liveStatus === 'FINISHED' ||
      fight.status === 'COMPLETE' ||
      fight.status === 'CONFIRMED',
  );
  if (!priorAllDone) return null;

  const session = sessions.find((s) => s.id === currentFight.sessionId);
  if (!session) return null;

  return { session, opener };
}
