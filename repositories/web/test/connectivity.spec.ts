import { describe, expect, it } from 'vitest';
import { calculationOf, classifyFailure } from '../app/utils/connectivity';

const named = (name: string) => Object.assign(new Error('x'), { name });
const withStatus = (status: number) => Object.assign(new Error('x'), { name: 'FetchError', statusCode: status });

describe('classifyFailure', () => {
  it('treats a request that got no answer as no signal', () => {
    expect(classifyFailure(named('FetchError'))).toBe('OFFLINE');
    expect(classifyFailure(named('TypeError'))).toBe('OFFLINE');
  });

  it('treats a timeout as no signal', () => {
    expect(classifyFailure(named('TimeoutError'))).toBe('OFFLINE');
    expect(classifyFailure(named('AbortError'))).toBe('OFFLINE');
  });

  it('does not hide a bug in our own code as a lost connection', () => {
    expect(classifyFailure(new RangeError('boom'))).toBe('OTHER');
    expect(classifyFailure(undefined)).toBe('OTHER');
  });

  it('tells a refused order (422) from an ended login (401)', () => {
    expect(classifyFailure(withStatus(422))).toBe('REFUSED');
    expect(classifyFailure(withStatus(401))).toBe('SESSION');
  });

  it('treats the server failing (5xx) as "try later"', () => {
    expect(classifyFailure(withStatus(500))).toBe('SERVER');
    expect(classifyFailure(withStatus(502))).toBe('SERVER');
    expect(classifyFailure(withStatus(503))).toBe('SERVER');
  });

  it('treats any other refusal as final', () => {
    expect(classifyFailure(withStatus(400))).toBe('OTHER');
    expect(classifyFailure(withStatus(404))).toBe('OTHER');
  });

  it('reads the status from a response object too', () => {
    expect(classifyFailure({ name: 'FetchError', response: { status: 422 } })).toBe('REFUSED');
  });
});

describe('calculationOf', () => {
  it('finds the server\'s reasons in a refusal', () => {
    const calculation = { blockers: ['MINIMUM_NOT_REACHED'] };
    expect(calculationOf({ data: { data: { calculation } } })).toBe(calculation);
  });

  it('is undefined when the refusal carries none', () => {
    expect(calculationOf({ data: {} })).toBeUndefined();
    expect(calculationOf(undefined)).toBeUndefined();
  });
});
