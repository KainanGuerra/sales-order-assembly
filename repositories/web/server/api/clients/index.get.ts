import { backend } from '../../utils/backend';
import { requireUser } from '../../utils/session';

// The portfolio of the logged-in seller. Identity enforces it again.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (user.role !== 'SELLER') {
    throw createError({ statusCode: 403, statusMessage: 'Only a seller has a portfolio' });
  }
  return backend(event, 'identity', `/sellers/${encodeURIComponent(user.id)}/clients`);
});
