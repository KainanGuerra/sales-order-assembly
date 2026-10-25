import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';

export const INNER_AUTH_HEADER = 'x-inner-auth';

// Only callers that know the shared secret (the BFF) may use this service.
@Injectable()
export class InnerAuthGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers[INNER_AUTH_HEADER];
    if (typeof header !== 'string' || !this.matches(header)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private matches(provided: string): boolean {
    const expected = Buffer.from(this.env.INNER_AUTH);
    const actual = Buffer.from(provided);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
