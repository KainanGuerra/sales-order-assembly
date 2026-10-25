import { z } from 'zod';
import { backendAs } from '../../utils/backend';
import { startSession, type SessionUser } from '../../utils/session';

const PickSchema = z.object({ role: z.enum(['SELLER', 'SUPERVISOR']), id: z.string().trim().min(1).max(40) });

// Simulated login: the visitor picks a person. Identity confirms the person
// exists, then this server starts the session.
export default defineEventHandler(async (event) => {
  const pick = await readValidatedBody(event, PickSchema.parse);
  const user = await backendAs<SessionUser>(null, 'identity', '/sessions/validate', { method: 'POST', body: pick });
  await startSession(event, user);
  return user;
});
