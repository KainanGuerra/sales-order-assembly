import { z } from 'zod';
import { backend } from '../../../utils/backend';

const QuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() });

// The latest orders the logged-in seller made for one client. Orders only
// returns the seller's own.
export default defineEventHandler(async (event) => {
  const clientId = getRouterParam(event, 'clientId') ?? '';
  const { limit } = await getValidatedQuery(event, QuerySchema.parse);
  return backend(event, 'orders', '/orders', { query: { clientId, limit } });
});
