import { describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';
import { cookieOptions, newSessionId, RedisSessionStore, type SessionUser } from '../server/utils/session';

const user: SessionUser = { role: 'SELLER', id: 'V01', name: 'Carlos Menezes', supervisorId: 'S01', discountLimitBp: 500 };

function fakeRedis() {
  const data = new Map<string, string>();
  const redis = {
    getex: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => (data.delete(key) ? 1 : 0)),
  };
  return { redis, data };
}

describe('newSessionId', () => {
  it('is long enough to be unguessable and safe to put in a cookie', () => {
    expect(newSessionId()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('is different every time', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newSessionId()));
    expect(ids.size).toBe(500);
  });
});

describe('cookieOptions', () => {
  it('is HttpOnly, lax and expires with the session', () => {
    expect(cookieOptions({ ttlSeconds: 3600, cookieSecure: false })).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 3600,
    });
  });

  it('can be marked secure for HTTPS', () => {
    expect(cookieOptions({ ttlSeconds: 60, cookieSecure: true }).secure).toBe(true);
  });
});

describe('RedisSessionStore', () => {
  it('keeps the user in Redis with an expiry, and reads it back', async () => {
    const { redis } = fakeRedis();
    const store = new RedisSessionStore(redis as unknown as Redis);
    await store.set('abc', user, 3600);
    expect(redis.set).toHaveBeenCalledWith('session:abc', JSON.stringify(user), 'EX', 3600);
    expect(await store.get('abc', 3600)).toEqual(user);
  });

  it('pushes the expiry forward every time the session is read', async () => {
    const { redis } = fakeRedis();
    const store = new RedisSessionStore(redis as unknown as Redis);
    await store.set('abc', user, 3600);
    await store.get('abc', 1800);
    expect(redis.getex).toHaveBeenCalledWith('session:abc', 'EX', 1800);
  });

  it('answers null for an unknown or expired session', async () => {
    const { redis } = fakeRedis();
    expect(await new RedisSessionStore(redis as unknown as Redis).get('nope', 3600)).toBeNull();
  });

  it('forgets the user on logout', async () => {
    const { redis } = fakeRedis();
    const store = new RedisSessionStore(redis as unknown as Redis);
    await store.set('abc', user, 3600);
    await store.delete('abc');
    expect(await store.get('abc', 3600)).toBeNull();
  });

  it('keeps sessions apart', async () => {
    const { redis } = fakeRedis();
    const store = new RedisSessionStore(redis as unknown as Redis);
    await store.set('one', user, 3600);
    await store.set('two', { role: 'SUPERVISOR', id: 'S01', name: 'Marta Fernandes' }, 3600);
    expect((await store.get('one', 3600))?.id).toBe('V01');
    expect((await store.get('two', 3600))?.id).toBe('S01');
  });
});
