import { backend } from '../../utils/backend';

// The logged-in person's notifications, newest first. The service only ever
// answers with their own.
export default defineEventHandler((event) => {
  const { limit } = getQuery(event);
  return backend(event, 'notifications', '/notifications', { query: { limit: typeof limit === 'string' ? limit : undefined } });
});
