import { endSession } from '../../utils/session';

export default defineEventHandler(async (event) => {
  await endSession(event);
  return { ok: true };
});
