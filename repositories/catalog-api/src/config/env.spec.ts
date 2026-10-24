import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = { DATABASE_URL: 'postgres://x', INNER_AUTH: 'a-secret-with-16+chars' };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3002);
    expect(env.DB_SCHEMA).toBe('catalog');
    expect(env.SHOW_UNAVAILABLE_PRODUCTS).toBe(true);
  });

  it('reads the unavailable-products flag as a boolean', () => {
    expect(loadEnv({ ...valid, SHOW_UNAVAILABLE_PRODUCTS: 'false' }).SHOW_UNAVAILABLE_PRODUCTS).toBe(false);
  });

  it('fails when the database url is missing', () => {
    expect(() => loadEnv({ INNER_AUTH: valid.INNER_AUTH })).toThrow(/DATABASE_URL/);
  });

  it('fails when the inner-auth secret is too short', () => {
    expect(() => loadEnv({ ...valid, INNER_AUTH: 'short' })).toThrow(/INNER_AUTH/);
  });

  it('refuses a schema name that is not a plain identifier', () => {
    expect(() => loadEnv({ ...valid, DB_SCHEMA: 'x; drop schema catalog' })).toThrow(/DB_SCHEMA/);
  });
});
