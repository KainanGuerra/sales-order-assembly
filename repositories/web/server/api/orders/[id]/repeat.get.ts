import { backend } from '../../../utils/backend';

// A draft that repeats an old order. Nothing is saved.
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? '';
  return backend(event, 'orders', `/orders/${encodeURIComponent(id)}/repeat`);
});
