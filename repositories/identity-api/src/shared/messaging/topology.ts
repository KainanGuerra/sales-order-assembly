import { connect } from 'amqplib';

// What the consumer's queue needs on the broker before it starts: an exchange
// for dead letters, and the queue they end up in, bound under the consumer's
// own name. The main queue (declared by Nest) points its dead letters here.
export const DEAD_LETTER_EXCHANGE = 'orders.events.dlx';

export function deadLetterQueueOf(queue: string): string {
  return `${queue}.dlq`;
}

export async function assertDeadLetterTopology(url: string, queue: string): Promise<void> {
  const connection = await connect(url);
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
