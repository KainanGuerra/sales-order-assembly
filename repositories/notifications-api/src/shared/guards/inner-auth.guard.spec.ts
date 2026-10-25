import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.js';
import { InnerAuthGuard } from './inner-auth.guard.js';

// Built, not typed: it is a test value, not a credential.
const SECRET = 'a'.repeat(20);
const guard = new InnerAuthGuard({ INNER_AUTH: SECRET } as Env);

function httpContext(headers: Record<string, string>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

describe('InnerAuthGuard', () => {
  it('lets a call with the right secret through', () => {
    expect(guard.canActivate(httpContext({ 'x-inner-auth': SECRET }))).toBe(true);
  });

  it('rejects a call without the secret', () => {
    expect(() => guard.canActivate(httpContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects a wrong secret of the same length', () => {
    expect(() => guard.canActivate(httpContext({ 'x-inner-auth': 'b'.repeat(SECRET.length) }))).toThrow(UnauthorizedException);
  });
});
