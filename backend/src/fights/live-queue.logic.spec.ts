import {
  computeLiveStatuses,
  deriveLiveQueueBoard,
  type LiveQueueRow,
} from './live-queue.logic';

function createRow(input: Partial<LiveQueueRow> & { id: string }): LiveQueueRow {
  return {
    id: input.id,
    matId: input.matId ?? 'mat-1',
    orderInMat: input.orderInMat ?? 1,
    scheduleOrder: input.scheduleOrder ?? input.orderInMat ?? 1,
    status: input.status ?? 'QUEUED',
    isPlayable: input.isPlayable ?? true,
    isFinished: input.isFinished ?? false,
  };
}

describe('live-queue.logic', () => {
  it('marks the first ready scheduled fight as upcoming when nothing is running', () => {
    const statuses = computeLiveStatuses([
      createRow({ id: 'blocked-final', orderInMat: 1, isPlayable: false }),
      createRow({ id: 'queued-1', orderInMat: 2 }),
      createRow({ id: 'queued-2', orderInMat: 3 }),
    ]);

    expect(statuses.get('blocked-final')).toBe('PENDING');
    expect(statuses.get('queued-1')).toBe('UPCOMING');
  });

  it('derives current, on deck, and next directly from the scheduled mat queue', () => {
    const board = deriveLiveQueueBoard([
      createRow({ id: 'fight-1', orderInMat: 1, status: 'IN_PROGRESS' }),
      createRow({ id: 'fight-2', orderInMat: 2, status: 'ON_DECK' }),
      createRow({ id: 'fight-3', orderInMat: 3, status: 'QUEUED' }),
      createRow({
        id: 'fight-4',
        orderInMat: 4,
        status: 'CONFIRMED',
        isFinished: true,
      }),
    ]);

    expect(board.current?.id).toBe('fight-1');
    expect(board.onDeck?.id).toBe('fight-2');
    expect(board.next.map((row) => row.id)).toEqual(['fight-3']);
    expect(board.completed.map((row) => row.id)).toEqual(['fight-4']);
  });
});
