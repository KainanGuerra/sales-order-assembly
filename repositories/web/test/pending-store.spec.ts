import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingStore, type QueuedOrder } from '../app/stores/pending';
import type { OrderView } from '../app/types/api';

const line = { productId: 'P1', description: 'Arroz', sku: 'SKU-1', packFactor: 1, multipleOnly: false, unit: 'UNIT' as const, quantity: 10, discountBp: 0 };
const queued = (orderId: string, sellerId = 'V01'): Omit<QueuedOrder, 'state' | 'queuedAt'> => ({
  orderId,
  sellerId,
  clientId: 'C001',
  clientName: 'Mercadinho',
  lines: [line],
  orderDiscountBp: 0,
});
const accepted = (id: string) => ({ id, status: 'SUBMITTED' }) as OrderView;
const failure = (name: string, statusCode?: number, data?: unknown) => Object.assign(new Error('x'), { name, statusCode, data });
const offline = () => failure('FetchError');
const refused = (calculation = { blockers: ['MINIMUM_NOT_REACHED'] }) => failure('FetchError', 422, { data: { calculation } });

describe('pending orders', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('keeps one copy when the same order is queued twice', () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    pending.add(queued('A'));
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0].state).toBe('WAITING');
  });

  it('shows a seller only their own orders', () => {
    const pending = usePendingStore();
    pending.add(queued('A', 'V01'));
    pending.add(queued('B', 'V02'));
    expect(pending.of('V01').map((i) => i.orderId)).toEqual(['A']);
  });

  it('sends the waiting orders oldest first and removes the accepted ones', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    pending.add(queued('B'));
    const send = vi.fn(async (o: QueuedOrder) => accepted(o.orderId));
    const results = await pending.flush('V01', send);
    expect(send.mock.calls.map(([o]) => o.orderId)).toEqual(['A', 'B']);
    expect(results.map((r) => r.kind)).toEqual(['SENT', 'SENT']);
    expect(pending.items).toEqual([]);
  });

  it('never sends another seller\'s order', async () => {
    const pending = usePendingStore();
    pending.add(queued('A', 'V02'));
    const send = vi.fn(async (o: QueuedOrder) => accepted(o.orderId));
    await pending.flush('V01', send);
    expect(send).not.toHaveBeenCalled();
    expect(pending.items).toHaveLength(1);
  });

  it('keeps everything waiting, and stops, when there is no signal', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    pending.add(queued('B'));
    const send = vi.fn(async () => {
      throw offline();
    });
    const results = await pending.flush('V01', send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(results).toMatchObject([{ kind: 'STOPPED', why: 'OFFLINE' }]);
    expect(pending.items.map((i) => i.state)).toEqual(['WAITING', 'WAITING']);
  });

  it('keeps the order when the server fails or the login ended', async () => {
    for (const [error, why] of [
      [failure('FetchError', 503), 'SERVER'],
      [failure('FetchError', 401), 'SESSION'],
    ] as const) {
      setActivePinia(createPinia());
      const pending = usePendingStore();
      pending.add(queued('A'));
      const results = await pending.flush('V01', async () => {
        throw error;
      });
      expect(results).toMatchObject([{ kind: 'STOPPED', why }]);
      expect(pending.items[0].state).toBe('WAITING');
    }
  });

  it('keeps a refused order with the server\'s reasons and goes on to the next one', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    pending.add(queued('B'));
    const send = vi.fn(async (o: QueuedOrder) => {
      if (o.orderId === 'A') throw refused();
      return accepted(o.orderId);
    });
    const results = await pending.flush('V01', send);
    expect(results.map((r) => r.kind)).toEqual(['REFUSED', 'SENT']);
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0]).toMatchObject({ orderId: 'A', state: 'REFUSED', calculation: { blockers: ['MINIMUM_NOT_REACHED'] } });
  });

  it('does not send a refused order again', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    await pending.flush('V01', async () => {
      throw refused();
    });
    const send = vi.fn(async (o: QueuedOrder) => accepted(o.orderId));
    await pending.flush('V01', send);
    expect(send).not.toHaveBeenCalled();
  });

  it('treats a refusal other than a rule (such as 404) as final too', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    await pending.flush('V01', async () => {
      throw failure('FetchError', 404);
    });
    expect(pending.items[0]).toMatchObject({ state: 'REFUSED', calculation: undefined });
  });

  it('sends again with the same id after a failed attempt', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    const ids: string[] = [];
    await pending.flush('V01', async (o) => {
      ids.push(o.orderId);
      throw offline();
    });
    await pending.flush('V01', async (o) => {
      ids.push(o.orderId);
      return accepted(o.orderId);
    });
    expect(ids).toEqual(['A', 'A']);
    expect(pending.items).toEqual([]);
  });

  it('runs one round at a time', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    let release: () => void = () => undefined;
    const send = vi.fn(
      (o: QueuedOrder) =>
        new Promise<OrderView>((resolve) => {
          release = () => resolve(accepted(o.orderId));
        }),
    );
    const first = pending.flush('V01', send);
    expect(await pending.flush('V01', send)).toEqual([]);
    release();
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('can start a new round after one ended in failure', async () => {
    const pending = usePendingStore();
    pending.add(queued('A'));
    await pending.flush('V01', async () => {
      throw offline();
    });
    expect(pending.sending).toBe(false);
  });
});
