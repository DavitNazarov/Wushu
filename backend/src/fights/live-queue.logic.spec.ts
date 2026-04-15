import {
  computeLiveStatuses,
  deriveLiveQueueBoard,
  LiveQueueRow,
} from './live-queue.logic';

function createRow(input: Partial<LiveQueueRow> & { id: string }): LiveQueueRow {
  return {
    id: input.id,
    matId: input.matId ?? 'mat-1',
    orderInMat: input.orderInMat ?? 1,
    sessionOrder: input.sessionOrder ?? null,
    orderInSession: input.orderInSession ?? null,
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

  it('session-ordered fights sort before unassigned fights', () => {
    const board = deriveLiveQueueBoard([
      createRow({ id: 'unassigned-1', matId: null, orderInMat: null, scheduleOrder: 1 }),
      createRow({ id: 'session-2', matId: null, orderInMat: null, sessionOrder: 1, orderInSession: 2 }),
      createRow({ id: 'session-1', matId: null, orderInMat: null, sessionOrder: 1, orderInSession: 1 }),
    ]);

    // Session-assigned fights come first, ordered by session then position
    expect(board.current?.id).toBe('session-1');
    expect(board.onDeck?.id).toBe('session-2');
    expect(board.next.map((row) => row.id)).toEqual(['unassigned-1']);
  });

  it('orders fights across sessions: session 1 before session 2', () => {
    const board = deriveLiveQueueBoard([
      createRow({ id: 's2-f1', matId: null, orderInMat: null, sessionOrder: 2, orderInSession: 1 }),
      createRow({ id: 's1-f1', matId: null, orderInMat: null, sessionOrder: 1, orderInSession: 1 }),
      createRow({ id: 's1-f2', matId: null, orderInMat: null, sessionOrder: 1, orderInSession: 2 }),
    ]);

    expect(board.current?.id).toBe('s1-f1');
    expect(board.onDeck?.id).toBe('s1-f2');
    expect(board.next.map((row) => row.id)).toEqual(['s2-f1']);
  });
});
