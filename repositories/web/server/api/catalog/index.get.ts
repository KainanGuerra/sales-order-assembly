import { z } from 'zod';
import { backend } from '../../utils/backend';

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  // A client's price table; without one, the standard table.
  clientId: z.string().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

interface ClientView {
  priceTableId: string;
}

// The catalog page: a search, or the whole catalog by name when there is no
// text. The price table comes from the chosen client (read as the logged-in
// seller, so a client outside the portfolio is refused) or is the standard one;
// never from the browser.
export default defineEventHandler(async (event) => {
  const { q, clientId, limit, offset } = await getValidatedQuery(event, QuerySchema.parse);
  const priceTableId = clientId
    ? (await backend<ClientView>(event, 'identity', `/clients/${encodeURIComponent(clientId)}`)).priceTableId
    : useRuntimeConfig(event).defaultPriceTableId;
  return backend(event, 'catalog', '/products', { query: { q, limit, offset, priceTableId } });
});
