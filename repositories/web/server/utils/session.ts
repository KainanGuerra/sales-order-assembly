import { randomBytes } from 'node:crypto';
import type { H3Event } from 'h3';
import Redis from 'ioredis';

// The browser holds only a random, meaningless id in an HttpOnly cookie. The
// user it stands for lives in Redis with an expiry, so a session can be ended
// on the server (logout) and nothing about the user travels in the cookie.

export const SESSION_COOKIE = 'sid';

export interface SessionUser {
  role: 'SELLER' | 'SUPERVISOR';
  id: string;
  name: string;
  supervisorId?: string;
  discountLimitBp?: number;
}

// What the session needs from storage; tests use an in-memory version.
export interface SessionStore {
  // Returns the user and pushes the expiry forward (a sliding session).
  get(sessionId: string, ttlSeconds: number): Promise<SessionUser | null>;
  set(sessionId: string, user: SessionUser, ttlSeconds: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

const keyFor = (sessionId: string) => `session:${sessionId}`;

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  async get(sessionId: string, ttlSeconds: number): Promise<SessionUser | null> {
    const raw = await this.redis.getex(keyFor(sessionId), 'EX', ttlSeconds);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  }

  async set(sessionId: string, user: SessionUser, ttlSeconds: number): Promise<void> {
    await this.redis.set(keyFor(sessionId), JSON.stringify(user), 'EX', ttlSeconds);
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(keyFor(sessionId));
  }
}

// 256 bits from the system's random source: not guessable, never reused.
export function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function cookieOptions(config: { ttlSeconds: number; cookieSecure: boolean }) {
  return {
    httpOnly: true,
    // Not sent on cross-site POSTs. The API also refuses anything but JSON bodies (see content-type.ts).
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.ttlSeconds,
  };
}

let store: SessionStore | undefined;

function sessionStore(): SessionStore {
  if (!store) {
    store = new RedisSessionStore(new Redis(useRuntimeConfig().redisUrl, { maxRetriesPerRequest: 2 }));
  }
  return store;
}

// A new id on every login, so an id someone planted before the login is useless.
export async function startSession(event: H3Event, user: SessionUser): Promise<void> {
  const config = useRuntimeConfig().session;
  const sessionId = newSessionId();
  await sessionStore().set(sessionId, user, config.ttlSeconds);
  setCookie(event, SESSION_COOKIE, sessionId, cookieOptions(config));
}

export async function currentUser(event: H3Event): Promise<SessionUser | null> {
  const sessionId = getCookie(event, SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }
  return sessionStore().get(sessionId, useRuntimeConfig().session.ttlSeconds);
}

export async function endSession(event: H3Event): Promise<void> {
  const sessionId = getCookie(event, SESSION_COOKIE);
  if (sessionId) {
    await sessionStore().delete(sessionId);
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' });
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const user = (event.context.user as SessionUser | undefined) ?? (await currentUser(event));
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  return user;
}
