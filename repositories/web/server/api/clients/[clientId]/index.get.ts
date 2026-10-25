import { backend } from '../../../utils/backend';

export default defineEventHandler((event) => {
  const clientId = getRouterParam(event, 'clientId') ?? '';
  return backend(event, 'identity', `/clients/${encodeURIComponent(clientId)}`);
});
