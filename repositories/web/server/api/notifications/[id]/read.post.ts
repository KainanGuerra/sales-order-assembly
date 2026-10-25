import { backend } from '../../../utils/backend';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  await backend(event, 'notifications', `/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
  setResponseStatus(event, 204);
  return null;
});
