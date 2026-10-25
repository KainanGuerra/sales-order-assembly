import type { Logger } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import type { ZodType } from 'zod';

// How an event consumer treats a message, in one place:
//  - a message that does not match its schema can never succeed, so it is
//    dead-lettered at once (nack without requeue) instead of being retried;
//  - a handler that fails is retried: after a pause that grows with each
//    delivery, the message goes back to the queue (nack with requeue);
//  - the queue is a quorum queue with a delivery limit, so after the last
//    allowed delivery the broker moves the message to the dead-letter queue.
//  Nothing is dropped silently.

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

// 500 ms, 1 s, 2 s, 4 s, then 8 s at most.
export function backoffMs(deliveryCount: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, deliveryCount), MAX_BACKOFF_MS);
}

export function deliveryCountOf(headers: Record<string, unknown> | undefined): number {
  const count = Number(headers?.['x-delivery-count'] ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function consume<T>(
  context: RmqContext,
  schema: ZodType<T>,
  payload: unknown,
  handle: (event: T) => Promise<void>,
  logger: Pick<Logger, 'warn' | 'error'>,
  wait: (ms: number) => Promise<void> = pause,
): Promise<void> {
  const channel = context.getChannelRef() as { ack(m: unknown): void; nack(m: unknown, allUpTo: boolean, requeue: boolean): void };
  const message = context.getMessage() as { properties?: { headers?: Record<string, unknown> } };

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    logger.error(`Dead-lettering a message that does not match its schema: ${parsed.error.message}`);
    channel.nack(message, false, false);
    return;
  }

  try {
    await handle(parsed.data);
    channel.ack(message);
  } catch (error) {
    const delivery = deliveryCountOf(message.properties?.headers);
    logger.warn(`Handling failed on delivery ${delivery + 1}, will retry: ${(error as Error).message}`);
    await wait(backoffMs(delivery));
    channel.nack(message, false, true);
  }
}
