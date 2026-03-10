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

function compareQueueOrder(a: LiveQueueRow, b: LiveQueueRow): number {
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

