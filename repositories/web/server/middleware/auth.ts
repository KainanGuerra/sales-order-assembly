import { currentUser } from '../utils/session';

// Everything under /api needs a session, except what the login screen uses.
const PUBLIC = new Set(['/api/health', '/api/auth/options', '/api/auth/login', '/api/auth/logout']);

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/') || PUBLIC.has(path)) {
    return;
  }
  const user = await currentUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  event.context.user = user;
});
