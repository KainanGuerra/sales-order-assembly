import type { RmqContext } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { backoffMs, consume, deliveryCountOf } from './consume.js';

const Schema = z.object({ orderId: z.string() });

function fake(headers?: Record<string, unknown>) {
  const message = { properties: { headers } };
  const channel = { ack: vi.fn(), nack: vi.fn() };
  const context = { getChannelRef: () => channel, getMessage: () => message } as unknown as RmqContext;
  const logger = { warn: vi.fn(), error: vi.fn() };
  const wait = vi.fn(async () => undefined);
  return { message, channel, context, logger, wait };
}

describe('backoffMs', () => {
  it('doubles with every delivery and stops at 8 seconds', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffMs)).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
  });

  it('treats a negative count as the first delivery', () => {
    expect(backoffMs(-3)).toBe(500);
  });
});

describe('deliveryCountOf', () => {
  it('reads the count the broker adds, and defaults to zero', () => {
    expect(deliveryCountOf({ 'x-delivery-count': 3 })).toBe(3);
    expect(deliveryCountOf({})).toBe(0);
    expect(deliveryCountOf(undefined)).toBe(0);
    expect(deliveryCountOf({ 'x-delivery-count': 'nope' })).toBe(0);
  });
});

describe('consume', () => {
  it('acknowledges a message that was handled', async () => {
    const { context, channel, message, logger, wait } = fake();
    const handle = vi.fn(async () => undefined);
    await consume(context, Schema, { orderId: 'o1' }, handle, logger, wait);
    expect(handle).toHaveBeenCalledWith({ orderId: 'o1' });
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters a message that does not match its schema, without retrying or handling it', async () => {
    const { context, channel, message, logger, wait } = fake();
    const handle = vi.fn(async () => undefined);
    await consume(context, Schema, { orderId: 42 }, handle, logger, wait);
    expect(handle).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(wait).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('waits and puts a failed message back on the queue', async () => {
    const { context, channel, message, logger, wait } = fake({ 'x-delivery-count': 2 });
    await consume(context, Schema, { orderId: 'o1' }, async () => { throw new Error('database is down'); }, logger, wait);
    expect(wait).toHaveBeenCalledWith(2000);
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('waits before putting the message back, not after', async () => {
    const { context, channel, logger } = fake();
    const order: string[] = [];
    channel.nack.mockImplementation(() => order.push('nack'));
    const wait = vi.fn(async () => { order.push('wait'); });
    await consume(context, Schema, { orderId: 'o1' }, async () => { throw new Error('x'); }, logger, wait);
    expect(order).toEqual(['wait', 'nack']);
  });
});
