import { describe, expect, it } from 'vitest';
import { mapUpstreamError } from '../server/utils/upstream-error';

describe('mapUpstreamError', () => {
  it('passes a verdict from the service through, with its body', () => {
    const body = { code: 'ORDER_NOT_SUBMITTABLE', calculation: { canSubmit: false } };
    expect(mapUpstreamError({ statusCode: 422, data: body }, 'orders')).toMatchObject({ statusCode: 422, data: body });
  });

  it('reads the status from either field the HTTP client may use', () => {
    expect(mapUpstreamError({ status: 404 }, 'identity').statusCode).toBe(404);
    expect(mapUpstreamError({ statusCode: 403 }, 'identity').statusCode).toBe(403);
  });

  it.each([500, 502, 503])('says "unavailable" for a %i from the service', (statusCode) => {
    const failure = mapUpstreamError({ statusCode, data: { message: 'stack trace' } }, 'catalog');
    expect(failure.statusCode).toBe(503);
    expect(failure.data).toBeUndefined();
    expect(failure.message).toContain('catalog is unavailable');
  });

  it('says "unavailable" when there was no answer at all', () => {
    expect(mapUpstreamError(new Error('connect ECONNREFUSED'), 'orders').statusCode).toBe(503);
    expect(mapUpstreamError(undefined, 'orders').statusCode).toBe(503);
  });
});
