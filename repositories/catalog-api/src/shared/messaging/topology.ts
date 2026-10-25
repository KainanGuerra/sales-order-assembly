import { connect } from 'amqplib';

// What the consumer's queue needs on the broker before it starts: an exchange
// for dead letters, and the queue they end up in, bound under the consumer's
// own name. The main queue (declared by Nest) points its dead letters here.
export const DEAD_LETTER_EXCHANGE = 'orders.events.dlx';

export function deadLetterQueueOf(queue: string): string {
  return `${queue}.dlq`;
}

// The slice of a broker connection these functions use; tests pass a fake.
export interface BrokerChannel {
  assertExchange(name: string, type: string, options: object): Promise<unknown>;
  assertQueue(name: string, options: object): Promise<unknown>;
  bindQueue(queue: string, exchange: string, key: string): Promise<unknown>;
  checkQueue(queue: string): Promise<unknown>;
  unbindQueue(queue: string, exchange: string, key: string): Promise<unknown>;
  close(): Promise<unknown>;
  on?(event: 'error', listener: () => void): unknown;
}
export interface BrokerConnection {
  createChannel(): Promise<BrokerChannel>;
  close(): Promise<unknown>;
}
export type BrokerConnect = (url: string) => Promise<BrokerConnection>;

const defaultConnect: BrokerConnect = (url) => connect(url) as unknown as Promise<BrokerConnection>;

export async function assertDeadLetterTopology(url: string, queue: string, open: BrokerConnect = defaultConnect): Promise<void> {
  const connection = await open(url);
  try {
    const channel = await connection.createChannel();
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true });
    await channel.assertQueue(deadLetterQueueOf(queue), { durable: true, arguments: { 'x-queue-type': 'quorum' } });
    await channel.bindQueue(deadLetterQueueOf(queue), DEAD_LETTER_EXCHANGE, queue);
    await channel.close();
  } finally {
    await connection.close();
  }
}

// A queue keeps its bindings from one deployment to the next, and Nest only
// ever adds them. When an event this consumer used to handle is renamed or
// dropped, the old binding keeps delivering it to a queue with no handler for
// it, and every such message ends up in the dead-letter queue. Listing the
// retired patterns here removes them at start. A queue that does not exist yet
// (the first deployment) has nothing to remove.
export async function retireBindings(
  url: string,
  queue: string,
  exchange: string,
  retiredPatterns: string[],
  open: BrokerConnect = defaultConnect,
): Promise<void> {
  const connection = await open(url);
  try {
    // A check on a missing queue closes its channel, so it gets one of its own.
    const probe = await connection.createChannel();
    probe.on?.('error', () => undefined);
    const exists = await probe.checkQueue(queue).then(
      () => true,
      () => false,
    );
    if (!exists) {
      return;
    }
    const channel = await connection.createChannel();
    for (const pattern of retiredPatterns) {
      await channel.unbindQueue(queue, exchange, pattern);
    }
    await channel.close();
  } finally {
    await connection.close();
  }
}
