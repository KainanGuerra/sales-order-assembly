import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { parseActor, type Actor } from '../actor.js';

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
  const actor = parseActor(request.headers);
  if (!actor) {
    throw new UnauthorizedException('Missing or invalid user context');
  }
  return actor;
});
