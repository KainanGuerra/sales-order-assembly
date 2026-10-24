import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { status, type Metadata } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { timingSafeEqual } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';

export const INNER_AUTH_HEADER = 'x-inner-auth';

// Only callers that know the shared secret (the BFF and orders-api) may use
// this service. Works for HTTP headers and for gRPC metadata.
@Injectable()
export class InnerAuthGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const provided = this.extractSecret(context);
    if (!provided || !this.matches(provided)) {
      // An HTTP exception would reach a gRPC caller as UNKNOWN; say what it is.
      if (context.getType() === 'rpc') {
        throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Unauthenticated' });
      }
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractSecret(context: ExecutionContext): string | undefined {
    if (context.getType() === 'rpc') {
      const metadata = context.switchToRpc().getContext<Metadata>();
      const value = metadata.get(INNER_AUTH_HEADER)[0];
      return typeof value === 'string' ? value : undefined;
    }
    const header = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers[INNER_AUTH_HEADER];
    return typeof header === 'string' ? header : undefined;
  }

  private matches(provided: string): boolean {
    const expected = Buffer.from(this.env.INNER_AUTH);
    const actual = Buffer.from(provided);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
