import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = { DATABASE_URL: 'postgres://x', INNER_AUTH: 'a'.repeat(20) };

describe('loadEnv', () => {
  it('applies the business defaults: R$ 300.00 minimum and a 10% global ceiling', () => {
    const env = loadEnv(valid);
    expect(env.MIN_ORDER_CENTS).toBe(30_000);
    expect(env.MAX_DISCOUNT_BP).toBe(1_000);
    expect(env.DB_SCHEMA).toBe('orders');
  });

  it('reads the limits from the environment', () => {
    const env = loadEnv({ ...valid, MIN_ORDER_CENTS: '50000', MAX_DISCOUNT_BP: '500' });
    expect(env.MIN_ORDER_CENTS).toBe(50_000);
    expect(env.MAX_DISCOUNT_BP).toBe(500);
  });

  it('refuses a global ceiling above 100%', () => {
    expect(() => loadEnv({ ...valid, MAX_DISCOUNT_BP: '10001' })).toThrow(/MAX_DISCOUNT_BP/);
  });

  it('fails when the database url is missing', () => {
    expect(() => loadEnv({ INNER_AUTH: valid.INNER_AUTH })).toThrow(/DATABASE_URL/);
  });

  it('fails when the inner-auth value is too short', () => {
    expect(() => loadEnv({ ...valid, INNER_AUTH: 'short' })).toThrow(/INNER_AUTH/);
  });
});
