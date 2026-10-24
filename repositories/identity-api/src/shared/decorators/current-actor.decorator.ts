import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { parseActor, type Actor } from '../../modules/people/rules.js';

// Who is acting, as forwarded by the BFF after it validated the session.
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
  const actor = parseActor(request.headers);
  if (!actor) {
    throw new UnauthorizedException('Missing or invalid user context');
  }
  return actor;
});
