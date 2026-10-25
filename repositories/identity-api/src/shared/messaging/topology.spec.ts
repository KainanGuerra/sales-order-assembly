import { describe, expect, it, vi } from 'vitest';
import { assertDeadLetterTopology, retireBindings, type BrokerChannel, type BrokerConnect } from './topology.js';

function fakeBroker(options: { queueExists: boolean }) {
  const calls: string[] = [];
  const channel = (): BrokerChannel => ({
    assertExchange: vi.fn(async (name: string) => calls.push(`exchange ${name}`)),
    assertQueue: vi.fn(async (name: string) => calls.push(`queue ${name}`)),
    bindQueue: vi.fn(async (q: string, e: string, k: string) => calls.push(`bind ${q} ${e} ${k}`)),
    checkQueue: vi.fn(async (q: string) => {
      if (!options.queueExists) {
        throw new Error(`NOT_FOUND ${q}`);
      }
      calls.push(`check ${q}`);
    }),
    unbindQueue: vi.fn(async (q: string, e: string, k: string) => calls.push(`unbind ${q} ${e} ${k}`)),
    close: vi.fn(async () => undefined),
    on: vi.fn(),
  });
  const connection = { createChannel: vi.fn(async () => channel()), close: vi.fn(async () => undefined) };
  const open: BrokerConnect = vi.fn(async () => connection);
  return { calls, connection, open };
}

describe('assertDeadLetterTopology', () => {
  it('declares the dead-letter exchange and queue and binds them under the consumer name', async () => {
    const { calls, open, connection } = fakeBroker({ queueExists: true });
    await assertDeadLetterTopology('amqp://x', 'identity-api-order-events', open);
    expect(calls).toEqual([
      'exchange orders.events.dlx',
      'queue identity-api-order-events.dlq',
      'bind identity-api-order-events.dlq orders.events.dlx identity-api-order-events',
    ]);
    expect(connection.close).toHaveBeenCalled();
  });
});

describe('retireBindings', () => {
  it('removes each retired pattern from the queue', async () => {
    const { calls, open } = fakeBroker({ queueExists: true });
    await retireBindings('amqp://x', 'identity-api-order-events', 'orders.events', ['order.submitted', 'order.old'], open);
    expect(calls).toEqual([
      'check identity-api-order-events',
      'unbind identity-api-order-events orders.events order.submitted',
      'unbind identity-api-order-events orders.events order.old',
    ]);
  });

  it('does nothing on the first deployment, when the queue does not exist yet', async () => {
    const { calls, open } = fakeBroker({ queueExists: false });
    await retireBindings('amqp://x', 'identity-api-order-events', 'orders.events', ['order.submitted'], open);
    expect(calls).toEqual([]);
  });

  it('closes the connection even when removing a binding fails', async () => {
    const { open, connection } = fakeBroker({ queueExists: true });
    connection.createChannel.mockImplementationOnce(async () => ({
      checkQueue: vi.fn(async () => undefined),
      on: vi.fn(),
    }) as unknown as BrokerChannel);
    connection.createChannel.mockImplementationOnce(async () => ({
      unbindQueue: vi.fn(async () => { throw new Error('broker refused'); }),
      close: vi.fn(),
    }) as unknown as BrokerChannel);
    await expect(retireBindings('amqp://x', 'q', 'e', ['p'], open)).rejects.toThrow('broker refused');
    expect(connection.close).toHaveBeenCalled();
  });
});
