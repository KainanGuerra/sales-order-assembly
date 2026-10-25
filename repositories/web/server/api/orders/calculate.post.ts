import { backend } from '../../utils/backend';
import { OrderDraftSchema } from '../../utils/order-schemas';

// The draft lives in the browser; the rules live in orders. This only forwards.
export default defineEventHandler(async (event) => {
  const draft = await readValidatedBody(event, OrderDraftSchema.parse);
  return backend(event, 'orders', '/orders/calculate', { method: 'POST', body: draft });
});
