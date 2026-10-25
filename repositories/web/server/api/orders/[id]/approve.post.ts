import { backend } from '../../../utils/backend';

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? '';
  return backend(event, 'orders', `/orders/${encodeURIComponent(id)}/approve`, { method: 'POST' });
});
