import { backend } from '../../utils/backend';
import { SubmitOrderSchema } from '../../utils/order-schemas';

export default defineEventHandler(async (event) => {
  const order = await readValidatedBody(event, SubmitOrderSchema.parse);
  return backend(event, 'orders', '/orders', { method: 'POST', body: order });
});
