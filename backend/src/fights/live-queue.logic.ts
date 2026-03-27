export type LiveFightStatus = 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED';

export type LiveQueueRow = {
  id: string;
  matId: string | null;
  orderInMat: number | null;
  scheduleOrder: number | null;
  status: 'QUEUED' | 'ON_DECK' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETE' | 'CONFIRMED';
  isPlayable: boolean;
  isFinished: boolean;
};

export function compareQueueOrder(a: LiveQueueRow, b: LiveQueueRow): number {
  const matOrderA = a.orderInMat ?? Number.MAX_SAFE_INTEGER;
  const matOrderB = b.orderInMat ?? Number.MAX_SAFE_INTEGER;
  if (matOrderA !== matOrderB) return matOrderA - matOrderB;

  const scheduleA = a.scheduleOrder ?? Number.MAX_SAFE_INTEGER;
  const scheduleB = b.scheduleOrder ?? Number.MAX_SAFE_INTEGER;
  if (scheduleA !== scheduleB) return scheduleA - scheduleB;

  return a.id.localeCompare(b.id);
}

export function computeLiveStatuses(rows: LiveQueueRow[]): Map<string, LiveFightStatus> {
  const byMat = new Map<string, LiveQueueRow[]>();

  for (const row of rows) {
    const key = row.matId ?? '__UNASSIGNED__';
    const bucket = byMat.get(key) ?? [];
    bucket.push(row);
    byMat.set(key, bucket);
  }

  const statuses = new Map<string, LiveFightStatus>();

  for (const matRows of byMat.values()) {
    const sorted = [...matRows].sort(compareQueueOrder);

    const running = sorted.find(
      (row) =>
        !row.isFinished &&
        row.isPlayable &&
        (row.status === 'IN_PROGRESS' || row.status === 'PAUSED'),
    );

    const finishedIds = new Set(
      sorted.filter((row) => row.isFinished).map((row) => row.id),
    );
    for (const finishedId of finishedIds) statuses.set(finishedId, 'FINISHED');

    if (running) {
      statuses.set(running.id, 'RUNNING');
      const upcomingAfterRunning = sorted.find(
        (row) =>
          row.id !== running.id &&
          !row.isFinished &&
          row.isPlayable &&
          compareQueueOrder(row, running) > 0,
      );
      if (upcomingAfterRunning) {
        statuses.set(upcomingAfterRunning.id, 'UPCOMING');
      }
    } else {
      const upcoming = sorted.find((row) => !row.isFinished && row.isPlayable);
      if (upcoming) {
        statuses.set(upcoming.id, 'UPCOMING');
      }
    }

    for (const row of sorted) {
      if (statuses.has(row.id)) continue;
      if (row.isFinished) {
        statuses.set(row.id, 'FINISHED');
      } else {
        statuses.set(row.id, 'PENDING');
      }
    }
  }

  return statuses;
}

export type LiveQueueBoard<T extends LiveQueueRow> = {
  current: T | null;
  onDeck: T | null;
  next: T[];
  queue: T[];
  completed: T[];
};

export function deriveLiveQueueBoard<T extends LiveQueueRow>(
  rows: T[],
  options?: { nextCount?: number; completedCount?: number },
): LiveQueueBoard<T> {
  const statuses = computeLiveStatuses(rows);
  const sorted = [...rows].sort(compareQueueOrder);

  const current =
    sorted.find((row) => statuses.get(row.id) === 'RUNNING') ??
    sorted.find((row) => statuses.get(row.id) === 'UPCOMING') ??
    null;

  const onDeck =
    current == null
      ? null
      : sorted.find((row) => {
          if (row.id === current.id) return false;
          if (statuses.get(row.id) === 'FINISHED') return false;
          if (!row.isPlayable) return false;
          return compareQueueOrder(row, current) > 0;
        }) ?? null;

  const next = sorted.filter((row) => {
    if (current && row.id === current.id) return false;
    if (onDeck && row.id === onDeck.id) return false;
    if (statuses.get(row.id) === 'FINISHED') return false;
    if (!current) return true;
    return compareQueueOrder(row, current) > 0;
  });

  const completed = sorted
    .filter((row) => statuses.get(row.id) === 'FINISHED')
    .sort((left, right) => compareQueueOrder(right, left));

  return {
    current,
    onDeck,
    next: next.slice(0, options?.nextCount ?? 3),
    queue: next.slice(0, options?.nextCount ?? 5),
    completed: completed.slice(0, options?.completedCount ?? 5),
  };
}
