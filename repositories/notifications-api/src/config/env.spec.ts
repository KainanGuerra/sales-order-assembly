import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = { DATABASE_URL: 'postgres://x', INNER_AUTH: 'a'.repeat(20) };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3004);
    expect(env.DB_SCHEMA).toBe('notifications');
    expect(env.STREAM_HEARTBEAT_SECONDS).toBe(25);
    expect(env.CONSUMER_MAX_DELIVERIES).toBe(5);
  });

  it('fails when the database url is missing', () => {
    expect(() => loadEnv({ INNER_AUTH: valid.INNER_AUTH })).toThrow(/DATABASE_URL/);
  });

  it('fails when the inner-auth value is too short', () => {
    expect(() => loadEnv({ ...valid, INNER_AUTH: 'short' })).toThrow(/INNER_AUTH/);
  });

  it('refuses a schema name that is not a plain identifier', () => {
    expect(() => loadEnv({ ...valid, DB_SCHEMA: 'x; drop schema notifications' })).toThrow(/DB_SCHEMA/);
  });
});
