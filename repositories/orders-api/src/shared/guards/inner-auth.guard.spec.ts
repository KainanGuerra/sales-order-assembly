import { Metadata, status } from '@grpc/grpc-js';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.js';
import { InnerAuthGuard } from './inner-auth.guard.js';

// Built, not typed: it is a test value, not a credential.
const SECRET = 'a'.repeat(20);
const guard = new InnerAuthGuard({ INNER_AUTH: SECRET } as Env);

function httpContext(headers: Record<string, string>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function rpcContext(secret?: string): ExecutionContext {
  const metadata = new Metadata();
  if (secret) {
    metadata.set('x-inner-auth', secret);
  }
  return { getType: () => 'rpc', switchToRpc: () => ({ getContext: () => metadata }) } as unknown as ExecutionContext;
}

describe('InnerAuthGuard', () => {
  it('lets an HTTP call with the right secret through', () => {
    expect(guard.canActivate(httpContext({ 'x-inner-auth': SECRET }))).toBe(true);
  });

  it('rejects an HTTP call without the secret', () => {
    expect(() => guard.canActivate(httpContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects an HTTP call with a wrong secret of the same length', () => {
    expect(() => guard.canActivate(httpContext({ 'x-inner-auth': 'b'.repeat(SECRET.length) }))).toThrow(
      UnauthorizedException,
    );
  });

  it('lets a gRPC call with the right secret through', () => {
    expect(guard.canActivate(rpcContext(SECRET))).toBe(true);
  });

  it('answers a gRPC call without the secret with UNAUTHENTICATED', () => {
    try {
      guard.canActivate(rpcContext());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toMatchObject({ code: status.UNAUTHENTICATED });
    }
  });
});
