import { z } from 'zod';
import { backend } from '../../../utils/backend';

const QuerySchema = z.object({ q: z.string().trim().min(1).max(80), limit: z.coerce.number().int().min(1).max(50).optional() });

interface ClientView {
  priceTableId: string;
}

// Product search with the prices of one client. The price table comes from the
// client (read as the logged-in seller), never from the browser.
export default defineEventHandler(async (event) => {
  const clientId = getRouterParam(event, 'clientId') ?? '';
  const { q, limit } = await getValidatedQuery(event, QuerySchema.parse);
  const client = await backend<ClientView>(event, 'identity', `/clients/${encodeURIComponent(clientId)}`);
  return backend(event, 'catalog', '/products', { query: { q, limit, priceTableId: client.priceTableId } });
});
