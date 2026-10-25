import { backend } from '../../../utils/backend';
import { RejectOrderSchema } from '../../../utils/order-schemas';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const reason = await readValidatedBody(event, RejectOrderSchema.parse);
  return backend(event, 'orders', `/orders/${encodeURIComponent(id)}/reject`, { method: 'POST', body: reason });
});
